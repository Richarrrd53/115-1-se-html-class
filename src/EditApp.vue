<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

import {
  stages,
  lessons,
  type Lesson,
  addStage,
  updateStage,
  deleteStage,
  createEmptyLesson,
  addLesson,
  deleteLesson,
  resetToDefault,
  importLessonsTs,
  generateLessonsTsCode,
  saveCourseData,
  saveCourseDataToDatabase,
  syncCourseDataFromDatabase,
  isSyncingCourseData,
  lastSyncTime,
} from './courseStore'
import { isEditorAuthenticated, verifyEditorPassword, setEditorAuthenticated } from './auth'
import { COURSE_MEMBERS } from './courseMembers'
import { supabase } from './supabase'
import MathCurveLoader from './components/MathCurveLoader.vue'
import TaChatDrawer from './components/TaChatDrawer.vue'
import AdminAnnouncementManager from './components/AdminAnnouncementManager.vue'
import {
  sqlLessons,
  saveSqlCourseData,
  resetSqlCourseData,
  saveSqlCourseDataToDatabase,
  syncSqlCourseDataFromDatabase,
  type SqlUnit,
} from './sqlCourseStore'

const baseUrl = import.meta.env.BASE_URL
const isTaChatOpen = ref(false)
const taUnreadCount = ref(0)

// 權限驗證狀態
const isAuthenticated = ref(isEditorAuthenticated())
const inputPassword = ref('')
const authError = ref('')
const isVerifying = ref(false)
const isAuthShaking = ref(false)
let authShakeTimer: ReturnType<typeof setTimeout> | null = null

function triggerAuthShake() {
  if (authShakeTimer) clearTimeout(authShakeTimer)
  isAuthShaking.value = false
  requestAnimationFrame(() => {
    isAuthShaking.value = true
    authShakeTimer = setTimeout(() => {
      isAuthShaking.value = false
      authShakeTimer = null
    }, 420)
  })
}

async function handleLogin() {
  if (!inputPassword.value) {
    authError.value = '請輸入管理密碼！'
    triggerAuthShake()
    return
  }
  isVerifying.value = true
  authError.value = ''
  try {
    const res = await verifyEditorPassword(inputPassword.value)
    if (res.success) {
      isAuthenticated.value = true
      inputPassword.value = ''
      if (currentViewMode.value === 'grades') {
        loadStudentsData()
      }
    } else {
      authError.value = res.message
      triggerAuthShake()
    }
  } catch (err: any) {
    authError.value = err?.message || '驗證失敗'
    triggerAuthShake()
  } finally {
    isVerifying.value = false
  }
}

async function handleAuthOverlayClick() {
  if (isVerifying.value) return
  await handleLogin()
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (!isAuthenticated.value) {
      handleAuthOverlayClick()
      return
    }
    if (isMoreMenuOpen.value) {
      isMoreMenuOpen.value = false
      return
    }
    if (selectedDetailStudent.value) selectedDetailStudent.value = null
    if (showStageModal.value) showStageModal.value = false
    if (showExportModal.value) showExportModal.value = false
  }
}

function handleDocumentClick(e: MouseEvent) {
  if (isMoreMenuOpen.value && moreMenuRef.value && !moreMenuRef.value.contains(e.target as Node)) {
    isMoreMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('click', handleDocumentClick)
  if (isAuthenticated.value && currentViewMode.value === 'grades') {
    loadStudentsData()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('click', handleDocumentClick)
  if (authShakeTimer) clearTimeout(authShakeTimer)
})

function handleLock() {
  setEditorAuthenticated(false)
  isAuthenticated.value = false
  inputPassword.value = ''
  authError.value = ''
}

// ==================== 管理員模式分頁與學生成績管理 ====================
export interface StudentAdminRecord {
  studentId: string
  name: string
  email?: string
  group?: string
  lastSeenAt: string | null
  onlineDurationMinutes: number
  scores: Record<string, number>
  completedLessons: Record<string, boolean>
  completedCount: number
  averageScore: number
  submissionsCount: number
  isDirty?: boolean
}

const currentViewMode = ref<'lessons' | 'grades' | 'announcements'>('lessons')
const selectedContentCourse = ref<'html' | 'sql'>('html')
const gradeCourseFilter = ref<'html' | 'sql'>('html')
const studentsList = ref<StudentAdminRecord[]>([])
const isLoadingStudents = ref(false)
const studentSearchKeyword = ref('')
const selectedDetailStudent = ref<StudentAdminRecord | null>(null)
const saveSuccessMessage = ref('')
const isSavingAll = ref(false)

let lastStudentsLoadTime = 0
let isStudentsLoading = false

// 頂部導航「更多操作」下拉選單狀態
const isMoreMenuOpen = ref(false)
const moreMenuRef = ref<HTMLElement | null>(null)

function toggleMoreMenu() {
  isMoreMenuOpen.value = !isMoreMenuOpen.value
}

function closeMoreMenu() {
  isMoreMenuOpen.value = false
}

function handleMenuAction(actionFn: () => void) {
  closeMoreMenu()
  actionFn()
}

function handleMenuImportTs(e: Event) {
  closeMoreMenu()
  handleImportTs(e)
}

function switchViewToGrades() {
  closeMoreMenu()
  currentViewMode.value = 'grades'
  if (studentsList.value.length === 0 || Date.now() - lastStudentsLoadTime > 60000) {
    loadStudentsData()
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '尚未上線'
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

const filteredStudents = computed(() => {
  const kw = studentSearchKeyword.value.trim().toLowerCase()
  if (!kw) return studentsList.value
  return studentsList.value.filter(
    (s) =>
      s.studentId.toLowerCase().includes(kw) ||
      s.name.toLowerCase().includes(kw) ||
      (s.group && s.group.toLowerCase().includes(kw)),
  )
})

const activeStudentsCount = computed(() => {
  return studentsList.value.filter((s) => s.lastSeenAt || s.onlineDurationMinutes > 0).length
})

const gradeLessons = computed(() => gradeCourseFilter.value === 'html'
  ? lessons.value
  : sqlLessons.value
    .filter((unit) => unit.hasExercise !== false)
    .map((unit) => ({ ...unit, id: `sql-${unit.id}` })))

function getStudentCourseScores(student: StudentAdminRecord, units = gradeLessons.value): number[] {
  return units
    .map((unit) => student.scores[unit.id])
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
}

function getStudentCourseAverage(student: StudentAdminRecord): number {
  const scores = getStudentCourseScores(student)
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0
}

function getStudentCourseCompletedCount(student: StudentAdminRecord): number {
  return gradeLessons.value.filter((unit) => student.completedLessons[unit.id] || (student.scores[unit.id] ?? 0) >= 80).length
}

const overallAverageScore = computed(() => {
  const averages = studentsList.value
    .map((student) => getStudentCourseAverage(student))
    .filter((average) => average > 0)
  return averages.length ? Math.round(averages.reduce((sum, average) => sum + average, 0) / averages.length) : 0
})

async function loadStudentsData(force: boolean | Event = false) {
  const isForce = force === true
  // 1. 若非強制重新整理且 60 秒內已載入過數據，直接使用記憶體中數據，不頻繁請求
  if (!isForce && studentsList.value.length > 0 && Date.now() - lastStudentsLoadTime < 60000) {
    return
  }
  if (isStudentsLoading) return
  isStudentsLoading = true
  isLoadingStudents.value = true
  try {
    await fetchStudentsData()
    lastStudentsLoadTime = Date.now()
  } catch (err) {
    console.warn('載入學生成績資料出錯：', err)
  } finally {
    isLoadingStudents.value = false
    isStudentsLoading = false
  }
}

async function fetchStudentsData() {
  // 1. 初始化名單（以本地 COURSE_MEMBERS 為基礎）
  const memberMap = new Map<string, StudentAdminRecord>()
  for (const m of COURSE_MEMBERS) {
    memberMap.set(m.studentId.toLowerCase(), {
      studentId: m.studentId,
      name: m.name,
      email: m.email || '',
      group: m.group || '',
      lastSeenAt: null,
      onlineDurationMinutes: 0,
      scores: {},
      completedLessons: {},
      completedCount: 0,
      averageScore: 0,
      submissionsCount: 0,
      isDirty: false,
    })
  }

  // 2. 從 course_members 補充學生資料（僅讀取必要欄位，不 select *）
  try {
    const { data: remoteMembers } = await supabase
      .from('course_members')
      .select('student_id, name, email')
    if (remoteMembers && remoteMembers.length > 0) {
      for (const rm of remoteMembers) {
        if (!rm.student_id) continue
        const normId = rm.student_id.toLowerCase()
        const existing = memberMap.get(normId)
        if (existing) {
          if (rm.name) existing.name = rm.name
          if (rm.email) existing.email = rm.email
        } else {
          memberMap.set(normId, {
            studentId: rm.student_id,
            name: rm.name,
            email: rm.email || '',
            group: '',
            lastSeenAt: null,
            onlineDurationMinutes: 0,
            scores: {},
            completedLessons: {},
            completedCount: 0,
            averageScore: 0,
            submissionsCount: 0,
            isDirty: false,
          })
        }
      }
    }
  } catch {}

  // 3. 查詢實際作業作答紀錄（絕不 select *，徹底排除 code 與 ai_feedback 等大量文本欄位，排除心跳與系統備份）
  try {
    const { data: subs } = await supabase
      .from('practice_submissions')
      .select('student_id, student_name, lesson_id, score, completed, online_duration_minutes, created_at')
      .neq('student_id', '__SYSTEM_COURSE_DATA__')
      .neq('lesson_id', '__HEARTBEAT__')
      .order('created_at', { ascending: false })
      .limit(2000)

    if (subs) {
      for (const sub of subs) {
        if (!sub.student_id || sub.student_id === '__SYSTEM_COURSE_DATA__') continue
        const normId = sub.student_id.toLowerCase()
        let st = memberMap.get(normId)
        if (!st) {
          st = {
            studentId: sub.student_id,
            name: sub.student_name || sub.student_id,
            email: '',
            group: '',
            lastSeenAt: null,
            onlineDurationMinutes: 0,
            scores: {},
            completedLessons: {},
            completedCount: 0,
            averageScore: 0,
            submissionsCount: 0,
            isDirty: false,
          }
          memberMap.set(normId, st)
        }

        st.submissionsCount++

        const subScore = typeof sub.score === 'number' ? sub.score : 0
        const subCompleted = typeof sub.completed === 'boolean' ? sub.completed : false
        const subDuration = typeof sub.online_duration_minutes === 'number' ? sub.online_duration_minutes : 0

        if (subScore > 0) {
          st.scores[sub.lesson_id] = Math.max(st.scores[sub.lesson_id] || 0, subScore)
        }
        if (subCompleted || subScore >= 80) {
          st.completedLessons[sub.lesson_id] = true
        }
        if (subDuration > 0) {
          st.onlineDurationMinutes = Math.max(st.onlineDurationMinutes, subDuration)
        }
        if (!st.lastSeenAt || new Date(sub.created_at) > new Date(st.lastSeenAt)) {
          st.lastSeenAt = sub.created_at
        }
      }
    }
  } catch (err) {
    console.warn('載入作業作答紀錄略過：', err)
  }

  // 4. 僅查詢近期心跳紀錄以獲取學生最新活躍時間與在線時長（僅查詢必要 3 個輕量欄位，並加上 limit 限制，防止全文掃描超時）
  try {
    const { data: heartbeats } = await supabase
      .from('practice_submissions')
      .select('student_id, online_duration_minutes, created_at')
      .eq('lesson_id', '__HEARTBEAT__')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (heartbeats) {
      for (const hb of heartbeats) {
        if (!hb.student_id) continue
        const normId = hb.student_id.toLowerCase()
        const st = memberMap.get(normId)
        if (st) {
          if (typeof hb.online_duration_minutes === 'number' && hb.online_duration_minutes > 0) {
            st.onlineDurationMinutes = Math.max(st.onlineDurationMinutes, hb.online_duration_minutes)
          }
          if (!st.lastSeenAt || new Date(hb.created_at) > new Date(st.lastSeenAt)) {
            st.lastSeenAt = hb.created_at
          }
        }
      }
    }
  } catch (err) {
    console.warn('載入心跳紀錄略過：', err)
  }

  // 5. 彙整統計各學生平均分與完成單元數
  studentsList.value = Array.from(memberMap.values()).map((st) => {
    st.completedCount = Object.values(st.completedLessons).filter(Boolean).length
    const scoreVals = Object.values(st.scores) as number[]
    st.averageScore = scoreVals.length
      ? Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length)
      : 0
    return st
  })
}

async function saveStudent(student: StudentAdminRecord) {
  const scoreVals = Object.values(student.scores) as number[]
  student.averageScore = scoreVals.length
    ? Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length)
    : 0
  student.completedCount = Object.values(student.completedLessons).filter(Boolean).length

  try {
    await fetch('/api/admin/students', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student),
    })
  } catch {}

  try {
    await supabase.from('course_members').update({ name: student.name }).eq('student_id', student.studentId)
    for (const [lessonId, score] of Object.entries(student.scores)) {
      const isCompleted = student.completedLessons[lessonId] || score >= 80
      const { error } = await supabase.from('practice_submissions').insert({
        student_id: student.studentId,
        student_name: student.name,
        lesson_id: lessonId,
        code: '{}',
        completed: isCompleted,
        score: score,
        online_duration_minutes: student.onlineDurationMinutes,
      })
      // 若遠端無獨立欄位，存入 code.__meta 備援
      if (error) {
        await supabase.from('practice_submissions').insert({
          student_id: student.studentId,
          student_name: student.name,
          lesson_id: lessonId,
          code: JSON.stringify({
            __meta: {
              completed: isCompleted,
              score,
              online_duration_minutes: student.onlineDurationMinutes,
            },
          }),
        })
      }
    }
  } catch (err) {
    console.warn('Supabase 更新略過：', err)
  }

  student.isDirty = false
  saveSuccessMessage.value = `已成功儲存學生【${student.name} (${student.studentId})】的成績與資料！`
  setTimeout(() => {
    saveSuccessMessage.value = ''
  }, 4000)
}

async function saveAllDirtyStudents() {
  const dirtyList = studentsList.value.filter((s) => s.isDirty)
  if (dirtyList.length === 0) {
    alert('目前沒有已修改的學生資料。')
    return
  }
  isSavingAll.value = true
  for (const st of dirtyList) {
    await saveStudent(st)
  }
  isSavingAll.value = false
  saveSuccessMessage.value = `已成功儲存全部 ${dirtyList.length} 位學生的修改紀錄！`
}

function openStudentDetail(student: StudentAdminRecord) {
  selectedDetailStudent.value = student
}

function closeStudentDetail() {
  if (selectedDetailStudent.value?.isDirty) {
    saveStudent(selectedDetailStudent.value)
  }
  selectedDetailStudent.value = null
}

function exportStudentsCsv() {
  const headers = ['課程', '學號', '姓名', '最近上線時間', '累積上線時長(分鐘)', '已完成單元數', '平均成績']
  const lessonIds = gradeLessons.value.map((unit) => unit.id)
  lessonIds.forEach((id) => headers.push(`單元${id}成績`))

  const rows = studentsList.value.map((st) => {
    const row = [
      gradeCourseFilter.value.toUpperCase(),
      `"${st.studentId}"`,
      `"${st.name}"`,
      `"${st.lastSeenAt ? new Date(st.lastSeenAt).toLocaleString() : '未上線'}"`,
      st.onlineDurationMinutes,
      getStudentCourseCompletedCount(st),
      getStudentCourseAverage(st),
    ]
    lessonIds.forEach((id) => row.push(st.scores[id] ?? 0))
    return row.join(',')
  })

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `WebCraft_${gradeCourseFilter.value.toUpperCase()}_學生修課成績單_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}


// 當前選取的單元 ID
const selectedLessonId = ref<string>(lessons.value[0]?.id || '')
const selectedSqlLessonId = ref<string>(sqlLessons.value[0]?.id || '')

// 預防初始化為空時的 fallback
watch(
  lessons,
  (list) => {
    if (!list.some((l) => l.id === selectedLessonId.value) && list.length > 0) {
      selectedLessonId.value = list[0].id
    }
  },
  { immediate: true },
)

const currentLesson = computed(() => {
  return lessons.value.find((l) => l.id === selectedLessonId.value) || lessons.value[0]
})
const currentSqlLesson = computed(() => sqlLessons.value.find((unit) => unit.id === selectedSqlLessonId.value) || sqlLessons.value[0])
const sqlRowsJson = ref('')
const sqlRowsJsonError = ref('')
const sqlColumnsText = computed({
  get: () => currentSqlLesson.value?.columns.join(', ') || '',
  set: (value: string) => {
    if (currentSqlLesson.value) {
      currentSqlLesson.value.columns = value.split(',').map((column) => column.trim()).filter(Boolean)
    }
  },
})
const sqlChecklistText = computed({
  get: () => currentSqlLesson.value?.checklist.join('\n') || '',
  set: (value: string) => {
    if (currentSqlLesson.value) {
      currentSqlLesson.value.checklist = value.split('\n').map((item) => item.trim()).filter(Boolean)
    }
  },
})

watch(currentSqlLesson, (unit) => {
  sqlRowsJson.value = JSON.stringify(unit?.rows || [], null, 2)
  sqlRowsJsonError.value = ''
}, { immediate: true })

function applySqlRowsJson() {
  if (!currentSqlLesson.value) return
  try {
    const parsed = JSON.parse(sqlRowsJson.value)
    if (!Array.isArray(parsed) || parsed.some((row) => !Array.isArray(row))) {
      throw new Error('資料列需為二維陣列。')
    }
    currentSqlLesson.value.rows = parsed.map((row: unknown[]) => row.map((value) => String(value)))
    sqlRowsJsonError.value = ''
  } catch (error: any) {
    sqlRowsJsonError.value = error?.message || '請輸入有效的 JSON 二維陣列。'
  }
}

function addSqlReviewPoint() {
  if (!currentSqlLesson.value) return
  currentSqlLesson.value.reviewPoints ||= []
  currentSqlLesson.value.reviewPoints.push({ title: '新觀念', body: '輸入觀念說明。', example: 'SELECT ...' })
}

function removeSqlReviewPoint(index: number) {
  currentSqlLesson.value?.reviewPoints?.splice(index, 1)
}

watch(
  sqlLessons,
  (list) => {
    if (!list.some((unit) => unit.id === selectedSqlLessonId.value) && list.length > 0) {
      selectedSqlLessonId.value = list[0].id
    }
  },
  { immediate: true },
)

// Tab 切換 (練習碼、參考答案、代碼補全詞語)
const starterTab = ref<'html' | 'css' | 'js'>('html')
const answerTab = ref<'html' | 'css' | 'js'>('html')

// 彈窗狀態
const showStageModal = ref(false)
const showExportModal = ref(false)
const newStageTitle = ref('')
const exportedCode = ref('')
const copySuccess = ref(false)

// 預覽相關
const previewIframe = ref<HTMLIFrameElement | null>(null)
const previewDevice = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const previewLoaded = ref(false)

// 側欄展開或折疊
const sidebarCollapsed = ref(false)

// 教材雲端同步狀態
const courseSaveStatus = ref('')

async function handleSaveCourseToDb() {
  courseSaveStatus.value = '正在儲存教材至雲端資料庫...'
  const [htmlResult, sqlResult] = await Promise.all([
    saveCourseDataToDatabase(),
    saveSqlCourseDataToDatabase(),
  ])
  if (htmlResult.success && sqlResult.success) {
    courseSaveStatus.value = 'HTML 與 SQL 教材已同步儲存至雲端！全班學生重新整理即可載入。'
  } else {
    courseSaveStatus.value = [htmlResult.message, sqlResult.message].filter((_, index) => index === 0 ? !htmlResult.success : !sqlResult.success).join('；')
  }
  setTimeout(() => {
    courseSaveStatus.value = ''
  }, 4000)
}

async function handleReloadCourseFromDb() {
  courseSaveStatus.value = '正在從雲端資料庫讀取最新教材...'
  const [htmlOk, sqlOk] = await Promise.all([
    syncCourseDataFromDatabase(),
    syncSqlCourseDataFromDatabase(),
  ])
  if (htmlOk || sqlOk) {
    courseSaveStatus.value = '已從雲端更新教材' + [htmlOk ? ' HTML' : '', sqlOk ? ' SQL' : ''].join('') + '！'
  } else {
    courseSaveStatus.value = '目前無法自雲端取得更新，已保持本機內容。'
  }
  setTimeout(() => {
    courseSaveStatus.value = ''
  }, 4000)
}

// 預覽是否自動刷新（預設關閉，由管理員手動點擊「重整預覽」或開啟此開關）
const autoRefreshPreview = ref(false)

// 監聽目前編輯的內容，儲存至本機 localStorage；若開啟自動刷新則即時同步至 iframe
watch(
  [stages, lessons, sqlLessons],
  () => {
    saveCourseData()
    saveSqlCourseData()
    if (autoRefreshPreview.value) {
      syncToIframe()
    }
  },
  { deep: true },
)

// 切換選中單元時通知 iframe
watch(selectedLessonId, (id) => {
  if (previewIframe.value && previewIframe.value.contentWindow) {
    previewIframe.value.contentWindow.postMessage({ type: 'SELECT_LESSON', id }, '*')
  }
})

function onIframeLoad() {
  previewLoaded.value = true
  syncToIframe()
  if (previewIframe.value && previewIframe.value.contentWindow) {
    previewIframe.value.contentWindow.postMessage(
      { type: 'SELECT_LESSON', id: selectedLessonId.value },
      '*',
    )
  }
}

function syncToIframe() {
  if (previewIframe.value && previewIframe.value.contentWindow) {
    previewIframe.value.contentWindow.postMessage(
      {
        type: 'WEBCRAFT_COURSES_UPDATED',
        data: {
          stages: JSON.parse(JSON.stringify(stages.value)),
          lessons: JSON.parse(JSON.stringify(lessons.value)),
        },
      },
      '*',
    )
  }
}

function reloadPreview() {
  syncToIframe()
  if (previewIframe.value) {
    previewIframe.value.src = `${baseUrl}index.html?lesson=${selectedLessonId.value}&adminPreview=true&t=${Date.now()}`
  }
}

// ================== 單元操作 ==================
function handleAddLesson() {
  if (selectedContentCourse.value === 'sql') {
    const nextNumber = sqlLessons.value.reduce((max, unit) => Math.max(max, unit.number || 0), 0) + 1
    const newUnit: SqlUnit = {
      id: 'sql-unit-' + Date.now(),
      number: nextNumber,
      title: '新的 SQL 單元',
      objective: '輸入此單元的學習目標。',
      concept: '輸入要複習的 SQL 觀念。',
      tableName: 'student（學生資料）',
      columns: ['id', 'name'],
      rows: [['S001', '範例同學']],
      question: '輸入練習題目。',
      starter: 'SELECT *\\nFROM student;',
      answer: 'SELECT id, name\\nFROM student;',
      checklist: ['使用 SELECT 查詢資料'],
    }
    sqlLessons.value.push(newUnit)
    selectedSqlLessonId.value = newUnit.id
    return
  }
  const currentStage = currentLesson.value?.stage || stages.value[0]?.id || 1
  const newL = createEmptyLesson(currentStage)
  addLesson(newL)
  selectedLessonId.value = newL.id
}

function handleDeleteSqlLesson(unit: SqlUnit) {
  if (unit.hasExercise === false) {
    alert('「總複習」單元不可刪除。')
    return
  }
  if (sqlLessons.value.filter((item) => item.hasExercise !== false).length <= 1) {
    alert('SQL 課程至少需要保留一個練習單元！')
    return
  }
  if (!confirm('確定要刪除「' + unit.title + '」嗎？')) return
  sqlLessons.value = sqlLessons.value.filter((item) => item.id !== unit.id)
  selectedSqlLessonId.value = sqlLessons.value[0]?.id || ''
}

function handleDeleteLesson(lesson: Lesson) {
  if (lessons.value.length <= 1) {
    alert('專案至少需要保留一個單元課程！')
    return
  }
  if (confirm(`確定要刪除「單元 ${lesson.number} · ${lesson.title}」嗎？`)) {
    const currentIndex = lessons.value.findIndex((l) => l.id === lesson.id)
    deleteLesson(lesson.id)
    const nextLesson = lessons.value[currentIndex] || lessons.value[currentIndex - 1] || lessons.value[0]
    if (nextLesson) {
      selectedLessonId.value = nextLesson.id
    }
  }
}

// ================== 概念管理 ==================
function addConcept() {
  if (!currentLesson.value) return
  if (!currentLesson.value.concepts) {
    currentLesson.value.concepts = []
  }
  currentLesson.value.concepts.push({
    name: '<code>語法/標籤</code>',
    description: '功能與說明',
  })
}

function removeConcept(index: number) {
  if (!currentLesson.value) return
  currentLesson.value.concepts.splice(index, 1)
}

// ================== 檢查清單管理 ==================
function addChecklistItem() {
  if (!currentLesson.value) return
  if (!currentLesson.value.practice.checklist) {
    currentLesson.value.practice.checklist = []
  }
  currentLesson.value.practice.checklist.push('新的檢核項目')
}

function removeChecklistItem(index: number) {
  if (!currentLesson.value) return
  currentLesson.value.practice.checklist.splice(index, 1)
}

// ================== 題目代碼補全詞語管理 ==================
function ensureCustomCompletions() {
  if (!currentLesson.value) return
  if (!currentLesson.value.practice) {
    currentLesson.value.practice = {
      instructions: '',
      starterCode: { html: '', css: '', js: '' },
      checklist: [],
      answer: { html: '', css: '', js: '' },
    }
  }
  if (!currentLesson.value.practice.customCompletions) {
    currentLesson.value.practice.customCompletions = { html: [], css: [], js: [] }
  }
  if (!currentLesson.value.practice.customCompletions.html) currentLesson.value.practice.customCompletions.html = []
  if (!currentLesson.value.practice.customCompletions.css) currentLesson.value.practice.customCompletions.css = []
  if (!currentLesson.value.practice.customCompletions.js) currentLesson.value.practice.customCompletions.js = []
}

watch(
  () => currentLesson.value?.id,
  () => {
    ensureCustomCompletions()
  },
  { immediate: true },
)

// ================== 階段管理 ==================
function handleAddStage() {
  if (!newStageTitle.value.trim()) return
  addStage(newStageTitle.value.trim())
  newStageTitle.value = ''
}

function handleDeleteStage(id: number) {
  const success = deleteStage(id)
  if (!success) {
    alert('該階段底下仍有單元，請先將單元移動到其他階段或刪除單元後再刪除該階段！')
  }
}

// ================== 匯出 / 備份 / 還原 ==================
function openExportModal() {
  exportedCode.value = generateLessonsTsCode()
  showExportModal.value = true
  copySuccess.value = false
}

function copyExportedCode() {
  navigator.clipboard.writeText(exportedCode.value).then(() => {
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  })
}

function downloadLessonsTs() {
  const codeStr = generateLessonsTsCode()
  const blob = new Blob([codeStr], { type: 'text/typescript;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lessons.ts'
  a.click()
  URL.revokeObjectURL(url)
}

function handleImportTs(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (text) {
      const res = importLessonsTs(text)
      if (res.success) {
        alert(res.message)
        if (lessons.value.length > 0) {
          selectedLessonId.value = lessons.value[0].id
        }
      } else {
        alert(res.message)
      }
    }
  }
  reader.readAsText(file)
  input.value = ''
}


function handleResetDefault() {
  if (confirm('確定要還原成專案的預設教材內容嗎？此操作將覆蓋目前的編輯內容！')) {
    resetToDefault()
    resetSqlCourseData()
    if (lessons.value.length > 0) {
      selectedLessonId.value = lessons.value[0].id
    }
    alert('已成功還原為預設教材！')
  }
}
</script>

<template>
  <div class="editor-app-shell">
    <!-- 密碼驗證鎖定對話框 -->
    <transition name="sys-modal" :duration="450">
      <div
        v-if="!isAuthenticated"
        class="modal-overlay auth-lock-overlay"
        @click.self="handleAuthOverlayClick"
      >
        <form
          class="modal-box auth-lock-box"
          :class="{ 'is-shaking': isAuthShaking }"
          @submit.prevent="handleLogin"
        >
          <div class="modal-header">
            <div class="auth-title">
              <span class="lock-icon">🔐</span>
              <h3>教材編輯器身分驗證</h3>
            </div>
          </div>
          <div class="modal-body auth-lock-body">
            <p class="auth-desc">本頁面提供課程內容管理與編輯功能，請輸入管理密碼以解鎖操作。</p>
            <div class="form-field">
              <label for="admin-pass">編輯權限密碼</label>
              <input
                id="admin-pass"
                v-model="inputPassword"
                type="password"
                class="input-control"
                placeholder="請輸入密碼..."
                autocomplete="current-password"
                :disabled="isVerifying"
                autofocus
              />
            </div>
            <p v-if="authError" class="auth-error-msg" role="alert">{{ authError }}</p>
          </div>
          <div class="modal-footer auth-actions">
            <button class="btn btn-primary btn-block" type="submit" :disabled="isVerifying">
              {{ isVerifying ? '驗證中...' : '🔓 解鎖編輯功能' }}
            </button>
            <a :href="baseUrl" class="btn btn-outline btn-block text-center">返回學習頁面</a>
          </div>
        </form>
      </div>
    </transition>

    <!-- 頂部工具導航列 -->
    <header class="editor-header">
      <div class="editor-brand">
        <div class="brand-mark">&lt;/&gt;</div>
        <div>
          <strong>WebCraft 管理員模式</strong>
          <span class="editor-brand-sub">教材編輯與學生成績／上線管理</span>
        </div>
      </div>

      <!-- 管理員模式視圖切換標籤 -->
      <div class="admin-mode-tabs">
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: currentViewMode === 'lessons' }"
          @click="currentViewMode = 'lessons'; closeMoreMenu()"
        >
          <svg class="btn-svg" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <span class="tab-label-full">教材內容編輯</span>
          <span class="tab-label-short">教材編輯</span>
        </button>
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: currentViewMode === 'grades' }"
          @click="switchViewToGrades"
        >
          <svg class="btn-svg" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span class="tab-label-full">學生練習成績與上線管理</span>
          <span class="tab-label-short">成績管理</span>
        </button>
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: currentViewMode === 'announcements' }"
          @click="currentViewMode = 'announcements'; closeMoreMenu()"
        >
          <svg class="btn-svg" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span class="tab-label-full">更新公告管理</span>
          <span class="tab-label-short">公告管理</span>
        </button>
      </div>

      <div class="editor-header-actions">
        <template v-if="currentViewMode === 'lessons'">
          <button v-if="selectedContentCourse === 'html'" class="btn btn-outline" @click="showStageModal = true" title="階段管理">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            <span class="btn-text-full">階段管理 ({{ stages.length }})</span>
            <span class="btn-text-short">階段 ({{ stages.length }})</span>
          </button>
          <button class="btn btn-primary" @click="handleAddLesson" :title="selectedContentCourse === 'html' ? '新增 HTML 單元' : '新增 SQL 單元'">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            {{ selectedContentCourse === 'html' ? '新增單元' : '新增 SQL 單元' }}
          </button>

          <button class="btn btn-primary" :disabled="isSyncingCourseData" @click="handleSaveCourseToDb" title="將所有課程教材同步儲存至雲端資料庫，跨裝置與全班即刻生效">
            <svg class="btn-svg" :class="{ 'btn-spin': isSyncingCourseData }" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span class="btn-text-full">{{ isSyncingCourseData ? '雲端儲存中...' : '儲存教材至資料庫' }}</span>
            <span class="btn-text-short">{{ isSyncingCourseData ? '儲存中...' : '儲存教材' }}</span>
          </button>

          <!-- 更多功能下拉選單 -->
          <div class="dropdown" ref="moreMenuRef">
            <button
              type="button"
              class="btn btn-outline dropdown-toggle"
              :class="{ active: isMoreMenuOpen }"
              @click.stop="toggleMoreMenu"
              title="更多檔案與操作"
            >
              <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
              <span>更多</span>
              <svg class="dropdown-chevron" :class="{ open: isMoreMenuOpen }" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <transition name="menu-pop">
              <div v-if="isMoreMenuOpen" class="dropdown-menu">
                <button
                  type="button"
                  class="dropdown-item"
                  :disabled="isSyncingCourseData"
                  @click="handleMenuAction(handleReloadCourseFromDb)"
                  :title="lastSyncTime ? `上次同步時間：${new Date(lastSyncTime).toLocaleTimeString()}` : '自雲端重新載入教材'"
                >
                  <svg class="item-svg" :class="{ 'btn-spin': isSyncingCourseData }" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  <span>雲端重新整理</span>
                </button>

                <div class="dropdown-divider"></div>

                <button
                  type="button"
                  class="dropdown-item"
                  @click="handleMenuAction(openExportModal)"
                >
                  <svg class="item-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>匯出 lessons.ts</span>
                </button>

                <label class="dropdown-item dropdown-file-label" title="選擇本機 lessons.ts 檔案進行匯入">
                  <svg class="item-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>匯入 lessons.ts</span>
                  <input type="file" accept=".ts,.js" style="display: none" @change="handleMenuImportTs" />
                </label>

                <div class="dropdown-divider"></div>

                <button
                  type="button"
                  class="dropdown-item dropdown-item-danger"
                  @click="handleMenuAction(handleResetDefault)"
                >
                  <svg class="item-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="1 4 1 10 7 10"></polyline>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                  </svg>
                  <span>還原預設教材</span>
                </button>
              </div>
            </transition>
          </div>
        </template>

        <template v-else-if="currentViewMode === 'grades'">
          <button class="btn btn-primary" :disabled="isSavingAll" @click="saveAllDirtyStudents" title="儲存已修改學生資料">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span class="btn-text-full">儲存修改 ({{ studentsList.filter(s => s.isDirty).length }})</span>
            <span class="btn-text-short">儲存 ({{ studentsList.filter(s => s.isDirty).length }})</span>
          </button>
          <button class="btn btn-secondary" @click="exportStudentsCsv" title="匯出全班成績為 CSV 檔案">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="btn-text-full">匯出成績 CSV</span>
            <span class="btn-text-short">匯出 CSV</span>
          </button>
          <button class="btn btn-outline" :disabled="isLoadingStudents" @click="loadStudentsData" title="重新載入成績與上線數據">
            <svg class="btn-svg" :class="{ 'btn-spin': isLoadingStudents }" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {{ isLoadingStudents ? '載入中...' : '重新整理' }}
          </button>
        </template>

        <div class="divider"></div>

        <button class="btn btn-outline btn-ta-chat" title="學生諮詢與提問對話" @click="isTaChatOpen = true">
          <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="btn-text-full">學生對話</span>
          <span class="btn-text-short">對話</span>
          <span v-if="taUnreadCount > 0" class="ta-unread-badge">{{ taUnreadCount }}</span>
        </button>

        <button class="btn btn-outline btn-lock" title="鎖定編輯器" @click="handleLock">
          <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span class="btn-text-full">鎖定</span>
        </button>

        <a :href="baseUrl" target="_blank" class="btn btn-link btn-open-preview" title="以新分頁開啟學生端學習頁面">
          <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span class="btn-text-full">開啟學習頁面</span>
          <span class="btn-text-short">學習頁面</span>
        </a>
      </div>
    </header>

    <!-- 教材雲端儲存成功通知 Toast -->
    <transition name="fade">
      <div v-if="courseSaveStatus" class="course-save-toast" role="status">
        <svg class="btn-svg" viewBox="0 0 24 24" width="16" height="16" stroke="#16a34a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>{{ courseSaveStatus }}</span>
      </div>
    </transition>

    <!-- 主工作區：教材編輯雙欄分割 -->
    <div v-if="currentViewMode === 'lessons'" class="editor-split-body">
      <!-- 左欄：單元導覽 + 編輯表單 -->
      <section class="editor-left-pane">
        <!-- 單元快捷導航欄 -->
        <div class="lessons-nav-bar">
          <div class="nav-bar-header">
            <label class="content-course-picker">
              <span>教材單元</span>
              <select v-model="selectedContentCourse" class="input-control">
                <option value="html">HTML 單元列表（{{ lessons.length }}）</option>
                <option value="sql">SQL 單元列表（{{ sqlLessons.length }}）</option>
              </select>
            </label>
            <button class="btn-text-sm" @click="sidebarCollapsed = !sidebarCollapsed">
              {{ sidebarCollapsed ? '展開列表 ▾' : '收合列表 ▴' }}
            </button>
          </div>

          <div v-if="selectedContentCourse === 'html'" v-show="!sidebarCollapsed" class="nav-pills-container">
            <div
              v-for="s in stages"
              :key="s.id"
              class="stage-pill-group"
            >
              <div class="stage-pill-title">{{ s.title }}</div>
              <div class="stage-pill-items">
                <button
                  v-for="item in lessons.filter(l => l.stage === s.id)"
                  :key="item.id"
                  class="nav-lesson-pill"
                  :class="{ active: item.id === selectedLessonId }"
                  @click="selectedLessonId = item.id"
                >
                  <span class="pill-num">{{ item.number }}</span>
                  <span class="pill-title">{{ item.title }}</span>
                </button>
              </div>
            </div>
          </div>
          <div v-else v-show="!sidebarCollapsed" class="nav-pills-container sql-admin-unit-list">
            <button
              v-for="(unit, index) in sqlLessons"
              :key="unit.id"
              type="button"
              class="nav-lesson-pill"
              :class="{ active: unit.id === selectedSqlLessonId }"
              @click="selectedSqlLessonId = unit.id"
            >
              <span class="pill-num">{{ index + 1 }}</span>
              <span class="pill-title">{{ unit.title }}</span>
            </button>
          </div>
        </div>

        <!-- 單元詳細編輯表單 -->
        <div v-if="selectedContentCourse === 'html' && currentLesson" class="form-container">
          <!-- 卡片 1: 基本資訊 (Topics) -->
          <div class="editor-card">
            <div class="card-title-row">
              <div class="card-title">
                <span class="card-badge">TOPICS</span>
                <h3>單元基本資訊</h3>
              </div>
              <button
                class="btn-delete"
                title="刪除此單元"
                @click="handleDeleteLesson(currentLesson)"
              >
                🗑️ 刪除單元
              </button>
            </div>

            <div class="form-grid-3">
              <div class="form-field">
                <label>單元編號 (number)</label>
                <input
                  v-model.number="currentLesson.number"
                  type="number"
                  min="1"
                  class="input-control"
                />
              </div>
              <div class="form-field">
                <label>所屬階段 (stage)</label>
                <select v-model.number="currentLesson.stage" class="input-control">
                  <option v-for="st in stages" :key="st.id" :value="st.id">
                    {{ st.title }} (ID: {{ st.id }})
                  </option>
                </select>
              </div>
              <div class="form-field">
                <label>分類類型 (type)</label>
                <input
                  v-model="currentLesson.type"
                  placeholder="如 HTML, CSS, JavaScript"
                  class="input-control"
                />
              </div>
            </div>

            <div class="form-field">
              <label>單元標題 (title)</label>
              <input
                v-model="currentLesson.title"
                placeholder="例如：語意化標籤與文件結構"
                class="input-control font-bold"
              />
            </div>

            <div class="form-field">
              <label>學習目標 (objective) <span class="md-hint">✨ 支援 Markdown</span></label>
              <textarea
                v-model="currentLesson.objective"
                rows="2"
                placeholder="輸入本單元學習目標..."
                class="input-control"
              ></textarea>
            </div>
          </div>

          <!-- 卡片 2: 觀念引言與關鍵概念 (Introductions & Concepts) -->
          <div class="editor-card">
            <div class="card-title-row">
              <div class="card-title">
                <span class="card-badge">INTRO</span>
                <h3>觀念引言與關鍵概念</h3>
              </div>
            </div>

            <div class="form-field">
              <label>觀念引言 (introduction) <span class="md-hint">✨ 支援 Markdown（如 **粗體**、`代碼`、- 清單）</span></label>
              <textarea
                v-model="currentLesson.introduction"
                rows="3"
                placeholder="輸入單元觀念介紹引言..."
                class="input-control"
              ></textarea>
            </div>

            <div class="concepts-section">
              <div class="sub-header">
                <label>關鍵概念卡片 (concepts: name / description) <span class="md-hint">✨ 說明支援 Markdown</span></label>
                <button class="btn-text-sm" @click="addConcept">
                  ➕ 新增概念
                </button>
              </div>

              <div class="concepts-list">
                <div
                  v-for="(concept, idx) in currentLesson.concepts"
                  :key="idx"
                  class="concept-row"
                >
                  <input
                    v-model="concept.name"
                    placeholder="標籤或名稱 (例: <header>)"
                    class="input-control concept-name-input"
                  />
                  <input
                    v-model="concept.description"
                    placeholder="概念詳細說明..."
                    class="input-control concept-desc-input"
                  />
                  <button
                    class="btn-icon-danger"
                    title="刪除此項目"
                    @click="removeConcept(idx)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 卡片 3: 範例展示 (Example) -->
          <div class="editor-card">
            <div class="card-title-row">
              <div class="card-title">
                <span class="card-badge">EXAMPLE</span>
                <h3>範例展示區塊</h3>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-field">
                <label>範例標題 (example.title)</label>
                <input
                  v-model="currentLesson.example.title"
                  placeholder="範例標題"
                  class="input-control"
                />
              </div>
              <div class="form-field">
                <label>範例說明 (example.description) <span class="md-hint">✨ 支援 Markdown</span></label>
                <input
                  v-model="currentLesson.example.description"
                  placeholder="範例說明"
                  class="input-control"
                />
              </div>
            </div>

            <div class="form-field">
              <label>範例展示程式碼 (example.code)</label>
              <textarea
                v-model="currentLesson.example.code"
                rows="6"
                class="input-control code-editor"
                spellcheck="false"
              ></textarea>
            </div>

            <div class="form-field">
              <label>範例渲染預覽 HTML (example.preview)</label>
              <textarea
                v-model="currentLesson.example.preview"
                rows="4"
                class="input-control code-editor"
                spellcheck="false"
              ></textarea>
            </div>
          </div>

          <!-- 卡片 4: 實作練習與挑戰 (Practice & Challenges) -->
          <div class="editor-card">
            <div class="card-title-row">
              <div class="card-title">
                <span class="card-badge">PRACTICE</span>
                <h3>實作練習與挑戰設定</h3>
              </div>
            </div>

            <div class="form-field">
              <label>實作任務指示 (challengeInstructions) <span class="md-hint">✨ 支援 Markdown（如 **目標**、`語法`、1. 步驟）</span></label>
              <textarea
                v-model="currentLesson.practice.instructions"
                rows="2"
                placeholder="輸入給學生的實作任務挑戰指示..."
                class="input-control"
              ></textarea>
            </div>

            <!-- 自我檢查清單 -->
            <div class="checklist-section">
              <div class="sub-header">
                <label>自我檢查清單 (checklist) <span class="md-hint">✨ 支援 Markdown</span></label>
                <button class="btn-text-sm" @click="addChecklistItem">
                  ➕ 新增檢查項
                </button>
              </div>


              <div class="checklist-items">
                <div
                  v-for="(_, cIdx) in currentLesson.practice.checklist"
                  :key="cIdx"
                  class="checklist-row"
                >
                  <span class="check-icon">✓</span>
                  <input
                    v-model="currentLesson.practice.checklist[cIdx]"
                    placeholder="檢核內容..."
                    class="input-control"
                  />
                  <button
                    class="btn-icon-danger"
                    title="刪除"
                    @click="removeChecklistItem(cIdx)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <!-- 練習起始程式碼 (challengeStarters) -->
            <div class="code-editor-group">
              <div class="editor-tabs-header">
                <label>練習起始程式碼 (challengeStarters)</label>
                <div class="editor-sub-tabs">
                  <button
                    :class="{ active: starterTab === 'html' }"
                    @click="starterTab = 'html'"
                  >
                    HTML
                  </button>
                  <button
                    :class="{ active: starterTab === 'css' }"
                    @click="starterTab = 'css'"
                  >
                    CSS
                  </button>
                  <button
                    :class="{ active: starterTab === 'js' }"
                    @click="starterTab = 'js'"
                  >
                    JavaScript
                  </button>
                </div>
              </div>

              <textarea
                v-if="starterTab === 'html'"
                v-model="currentLesson.practice.starterCode.html"
                rows="8"
                class="input-control code-editor"
                spellcheck="false"
                placeholder="輸入初始 HTML..."
              ></textarea>
              <textarea
                v-else-if="starterTab === 'css'"
                v-model="currentLesson.practice.starterCode.css"
                rows="8"
                class="input-control code-editor"
                spellcheck="false"
                placeholder="輸入初始 CSS..."
              ></textarea>
              <textarea
                v-else
                v-model="currentLesson.practice.starterCode.js"
                rows="8"
                class="input-control code-editor"
                spellcheck="false"
                placeholder="輸入初始 JavaScript..."
              ></textarea>
            </div>

            <!-- 參考解答 (challengeAnswers) -->
            <div class="code-editor-group mt-15">
              <div class="editor-tabs-header">
                <label>參考答案 (challengeAnswers)</label>
                <div class="editor-sub-tabs">
                  <button
                    :class="{ active: answerTab === 'html' }"
                    @click="answerTab = 'html'"
                  >
                    HTML
                  </button>
                  <button
                    :class="{ active: answerTab === 'css' }"
                    @click="answerTab = 'css'"
                  >
                    CSS
                  </button>
                  <button
                    :class="{ active: answerTab === 'js' }"
                    @click="answerTab = 'js'"
                  >
                    JavaScript
                  </button>
                </div>
              </div>

              <textarea
                v-if="answerTab === 'html'"
                v-model="currentLesson.practice.answer.html"
                rows="8"
                class="input-control code-editor"
                spellcheck="false"
                placeholder="輸入參考 HTML 答案..."
              ></textarea>
              <textarea
                v-else-if="answerTab === 'css'"
                v-model="currentLesson.practice.answer.css"
                rows="8"
                class="input-control code-editor"
                spellcheck="false"
                placeholder="輸入參考 CSS 答案..."
              ></textarea>
              <textarea
                v-else
                v-model="currentLesson.practice.answer.js"
                rows="8"
                class="input-control code-editor"
                spellcheck="false"
                placeholder="輸入參考 JavaScript 答案..."
              ></textarea>
            </div>
          </div>
        </div>
        <div v-if="selectedContentCourse === 'sql' && currentSqlLesson" class="form-container">
        <div class="editor-card">
          <div class="card-title-row">
            <div class="card-title">
              <span class="card-badge">POSTGRESQL</span>
              <h3>SQL 單元內容</h3>
            </div>
            <button
              v-if="currentSqlLesson.hasExercise !== false"
              class="btn-delete"
              title="刪除此 SQL 單元"
              @click="handleDeleteSqlLesson(currentSqlLesson)"
            >
              🗑️ 刪除單元
            </button>
          </div>
          <div class="form-grid-2">
            <div class="form-field">
              <label>單元標題</label>
              <input v-model="currentSqlLesson.title" class="input-control font-bold" />
            </div>
            <div class="form-field">
              <label>單元類型</label>
              <input :value="currentSqlLesson.hasExercise === false ? '觀念總複習' : 'SQL 練習'" class="input-control" disabled />
            </div>
          </div>
          <div class="form-field">
            <label>學習目標</label>
            <textarea v-model="currentSqlLesson.objective" rows="2" class="input-control"></textarea>
          </div>
          <div class="form-field">
            <label>單元標題下方的複習觀念</label>
            <textarea v-model="currentSqlLesson.concept" rows="3" class="input-control"></textarea>
          </div>
        </div>

        <div v-if="currentSqlLesson.hasExercise === false" class="editor-card">
          <div class="card-title-row">
            <div class="card-title">
              <span class="card-badge">REVIEW POINTS</span>
              <h3>總複習觀念卡片</h3>
            </div>
            <button class="btn-text-sm" @click="addSqlReviewPoint">➕ 新增觀念卡</button>
          </div>
          <div v-for="(point, index) in currentSqlLesson.reviewPoints" :key="index" class="sql-admin-point">
            <div class="form-grid-2">
              <div class="form-field">
                <label>標題</label>
                <input v-model="point.title" class="input-control" />
              </div>
              <button class="btn-icon-danger sql-admin-point-remove" title="刪除此觀念卡" @click="removeSqlReviewPoint(index)">✕</button>
            </div>
            <div class="form-field">
              <label>觀念說明</label>
              <textarea v-model="point.body" rows="2" class="input-control"></textarea>
            </div>
            <div class="form-field">
              <label>SQL 範例</label>
              <textarea v-model="point.example" rows="5" class="input-control code-editor" spellcheck="false"></textarea>
            </div>
          </div>
        </div>

        <template v-else>
          <div class="editor-card">
            <div class="card-title-row">
              <div class="card-title">
                <span class="card-badge">SIMULATED DATA</span>
                <h3>題目情境資料</h3>
              </div>
            </div>
            <div class="form-field">
              <label>資料表名稱與說明</label>
              <input v-model="currentSqlLesson.tableName" class="input-control" />
            </div>
            <div class="form-field">
              <label>欄位名稱（以逗號分隔）</label>
              <input v-model="sqlColumnsText" class="input-control" placeholder="例如：stuid, name, grade" />
            </div>
            <div class="form-field">
              <label>示意資料列（JSON 二維陣列）</label>
              <textarea v-model="sqlRowsJson" rows="7" class="input-control code-editor" spellcheck="false" @blur="applySqlRowsJson"></textarea>
              <small v-if="sqlRowsJsonError" class="sql-admin-error">{{ sqlRowsJsonError }}</small>
              <small v-else class="md-hint">每一列依欄位順序輸入，例如 [["S001", "小明", "90"]]</small>
            </div>
            <div class="form-field">
              <label>練習題目</label>
              <textarea v-model="currentSqlLesson.question" rows="3" class="input-control"></textarea>
            </div>
          </div>

          <div class="editor-card">
            <div class="card-title-row">
              <div class="card-title">
                <span class="card-badge">SQL PRACTICE</span>
                <h3>練習起始程式碼與參考答案</h3>
              </div>
            </div>
            <div class="form-field">
              <label>學生練習起始內容</label>
              <textarea v-model="currentSqlLesson.starter" rows="9" class="input-control code-editor" spellcheck="false"></textarea>
            </div>
            <div class="form-field">
              <label>參考答案</label>
              <textarea v-model="currentSqlLesson.answer" rows="9" class="input-control code-editor" spellcheck="false"></textarea>
            </div>
            <div class="form-field">
              <label>AI 檢查清單（每行一項）</label>
              <textarea v-model="sqlChecklistText" rows="5" class="input-control"></textarea>
            </div>
          </div>
        </template>
        </div>
      </section>

      <!-- 右欄：即時預覽 index.html -->
      <section v-if="selectedContentCourse === 'html'" class="editor-right-pane">
        <div class="preview-header-bar">
          <div class="preview-title-tag">
            <span class="live-dot" :class="{ off: !autoRefreshPreview }"></span>
            <strong>即時外觀預覽 (index.html)</strong>
            <button
              type="button"
              class="auto-refresh-toggle-btn"
              :class="{ active: autoRefreshPreview }"
              :title="autoRefreshPreview ? '已啟用自動刷新預覽（點擊關閉）' : '已關閉自動刷新預覽（點擊開啟）'"
              @click="autoRefreshPreview = !autoRefreshPreview"
            >
              自動刷新：{{ autoRefreshPreview ? '開' : '關' }}
            </button>
          </div>

          <div class="preview-controls">
            <div class="device-switch">
              <button
                :class="{ active: previewDevice === 'desktop' }"
                title="桌面模式 (100%)"
                @click="previewDevice = 'desktop'"
              >
                🖥️ 桌面
              </button>
              <button
                :class="{ active: previewDevice === 'tablet' }"
                title="平板模式 (768px)"
                @click="previewDevice = 'tablet'"
              >
                📱 平板
              </button>
              <button
                :class="{ active: previewDevice === 'mobile' }"
                title="手機模式 (390px)"
                @click="previewDevice = 'mobile'"
              >
                📱 手機
              </button>
            </div>

            <button class="btn btn-outline btn-sm" title="立即同步並重整預覽" @click="reloadPreview">
              🔄 立即重整預覽
            </button>
          </div>
        </div>

        <div class="iframe-container-wrapper" :class="previewDevice">
          <iframe
            ref="previewIframe"
            :src="`${baseUrl}index.html?lesson=${selectedLessonId}&adminPreview=true`"
            class="live-preview-frame"
            @load="onIframeLoad"
          ></iframe>
        </div>
      </section>
      <section v-else-if="selectedContentCourse === 'sql' && currentSqlLesson" class="editor-right-pane sql-admin-preview-pane">
        <div class="preview-header-bar">
          <div class="preview-title-tag">
            <span class="live-dot"></span>
            <strong>SQL 教材即時預覽</strong>
          </div>
          <div class="preview-controls">
            <div class="device-switch">
              <button :class="{ active: previewDevice === 'desktop' }" title="桌面模式" @click="previewDevice = 'desktop'">🖥️ 桌面</button>
              <button :class="{ active: previewDevice === 'tablet' }" title="平板模式" @click="previewDevice = 'tablet'">📱 平板</button>
              <button :class="{ active: previewDevice === 'mobile' }" title="手機模式" @click="previewDevice = 'mobile'">📱 手機</button>
            </div>
          </div>
        </div>
        <div class="iframe-container-wrapper sql-admin-preview-scroll" :class="previewDevice">
          <article class="sql-admin-preview-canvas" :class="previewDevice">
            <div class="sql-admin-preview-page">
              <div class="breadcrumb">SQL 複習 <span>/</span> 單元 {{ sqlLessons.findIndex((unit) => unit.id === currentSqlLesson.id) + 1 }}</div>
              <header class="lesson-heading sql-lesson-heading">
                <div>
                  <div class="eyebrow">CHAPTER {{ String(sqlLessons.findIndex((unit) => unit.id === currentSqlLesson.id) + 1).padStart(2, '0') }} · POSTGRESQL</div>
                  <h1>{{ currentSqlLesson.title }}</h1>
                  <p class="sql-unit-concept">{{ currentSqlLesson.concept }}</p>
                  <p v-if="currentSqlLesson.objective" class="lesson-objective">{{ currentSqlLesson.objective }}</p>
                </div>
              </header>

              <section v-if="currentSqlLesson.hasExercise === false" class="sql-overview-grid" aria-label="SQL 基礎觀念">
                <article v-for="point in currentSqlLesson.reviewPoints" :key="point.title" class="sql-overview-card">
                  <h2>{{ point.title }}</h2>
                  <p>{{ point.body }}</p>
                  <pre><code>{{ point.example }}</code></pre>
                </article>
              </section>

              <template v-else>
                <section class="example-card sql-example-card">
                  <div class="section-heading"><div><span class="section-kicker">情境資料</span><h2>{{ currentSqlLesson.tableName }}</h2></div><span class="chip">模擬資料</span></div>
                  <div class="sql-simulated-table-wrap">
                    <table class="sql-simulated-table">
                      <thead><tr><th v-for="column in currentSqlLesson.columns" :key="column">{{ column }}</th></tr></thead>
                      <tbody><tr v-for="(row, rowIndex) in currentSqlLesson.rows" :key="rowIndex"><td v-for="(value, colIndex) in row" :key="colIndex">{{ value }}</td></tr></tbody>
                    </table>
                  </div>
                  <p class="sql-simulation-note">這是題目用的示意資料，不會執行 SQL 或連接資料庫。</p>
                </section>
                <section class="challenge-card sql-challenge-card">
                  <div class="challenge-intro"><div><span class="section-kicker">實作練習</span><h2>動手寫查詢</h2><p class="challenge-instructions">{{ currentSqlLesson.question }}</p></div></div>
                  <div class="sql-editor-wrap">
                    <div class="sql-editor-toolbar"><span><i></i> query.sql</span><small>PostgreSQL</small></div>
                    <pre class="sql-admin-preview-code"><code>{{ currentSqlLesson.starter }}</code></pre>
                  </div>
                  <details class="sql-reference-answer"><summary>查看參考答案</summary><pre><code>{{ currentSqlLesson.answer }}</code></pre></details>
                </section>
              </template>
            </div>
          </article>
        </div>
      </section>
    </div>

    <!-- 主工作區：學生成績與上線狀況管理視圖 -->
    <div v-else-if="currentViewMode === 'grades'" class="admin-grades-container">
      <div class="grades-subbar">
        <div class="grades-metrics">
          <div class="metric-card">
            <span class="metric-label">修課學生總數</span>
            <strong class="metric-value">{{ studentsList.length }} 人</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">已上線練習人數</span>
            <strong class="metric-value">{{ activeStudentsCount }} 人</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">全班平均成績</span>
            <strong class="metric-value text-green">{{ overallAverageScore }} 分</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">課程總單元數</span>
            <strong class="metric-value">{{ gradeLessons.length }} 單元</strong>
          </div>
        </div>

        <div class="grades-filter-bar">
          <select v-model="gradeCourseFilter" class="input-control grades-course-filter" aria-label="選擇成績課程">
            <option value="html">HTML 練習成績</option>
            <option value="sql">SQL 練習成績</option>
          </select>
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              v-model="studentSearchKeyword"
              placeholder="搜尋學生姓名或學號..."
              class="input-control"
            />
          </div>
          <button
            class="btn btn-outline btn-sm"
            :disabled="isLoadingStudents"
            @click="() => loadStudentsData(true)"
            title="手動重新整理學生最新成績與上線數據"
          >
            <span v-if="isLoadingStudents">⏳ 載入中...</span>
            <span v-else>🔄 重新整理數據</span>
          </button>
        </div>
      </div>

      <!-- 儲存成功提示通知 -->
      <transition name="fade">
        <div v-if="saveSuccessMessage" class="grades-save-alert" role="status">
          <svg class="btn-svg" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          {{ saveSuccessMessage }}
        </div>
      </transition>

      <!-- 學生名單與成績數據表格 -->
      <div class="grades-table-wrapper">
        <div v-if="isLoadingStudents" class="grades-loading-state" style="padding: 56px 20px; display: flex; justify-content: center;">
          <MathCurveLoader
            size="md"
            label="正在載入學生名單與即時作答數據..."
            subtext="正在同步 Supabase 雲端資料庫最新成績與上線記錄"
          />
        </div>
        <table v-else class="grades-data-table">
          <thead>
            <tr>
              <th style="width: 120px">學號</th>
              <th style="width: 140px">姓名</th>
              <th style="width: 160px">最近上線時間</th>
              <th style="width: 130px">上線時長</th>
              <th style="width: 120px">完成進度</th>
              <th style="width: 110px">平均分數</th>
              <th>各單元得分</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="st in filteredStudents"
              :key="st.studentId"
              :class="{ 'row-dirty': st.isDirty }"
              class="clickable-student-row"
              @click="openStudentDetail(st)"
              title="點擊查看該學生詳細作答與各題評分"
            >
              <td>
                <span class="student-id-code">{{ st.studentId }}</span>
              </td>
              <td>
                <span class="student-name-text">
                  {{ st.name }}
                  <svg class="name-arrow-icon" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </span>
              </td>
              <td>
                <span class="last-seen-tag" :class="{ 'is-active': st.lastSeenAt }">
                  {{ formatDate(st.lastSeenAt) }}
                </span>
              </td>
              <td>
                <span class="duration-display-badge">⏱️ {{ st.onlineDurationMinutes || 0 }} 分</span>
              </td>
              <td>
                <span class="progress-badge">
                  {{ getStudentCourseCompletedCount(st) }} / {{ gradeLessons.length }}
                </span>
              </td>
              <td>
                <strong class="score-text" :class="{ 'score-high': getStudentCourseAverage(st) >= 80, 'score-low': getStudentCourseAverage(st) < 60 && getStudentCourseAverage(st) > 0 }">
                  {{ getStudentCourseAverage(st) > 0 ? `${getStudentCourseAverage(st)} 分` : '—' }}
                </strong>
              </td>
              <td>
                <!-- 橫向各單元成績表格呈現，未及格呈現紅色 -->
                <div class="unit-scores-table-wrapper">
                  <table class="unit-scores-table">
                    <thead>
                      <tr>
                        <th v-for="(l, index) in gradeLessons" :key="l.id" :title="l.title">
                          {{ l.number ?? index + 1 }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          v-for="l in gradeLessons"
                          :key="l.id"
                          :title="`${l.title} (單元 ${l.number ?? gradeLessons.findIndex((unit) => unit.id === l.id) + 1}): ${st.scores[l.id] !== undefined && st.scores[l.id] !== null ? st.scores[l.id] + ' 分' : '未評分'}`"
                        >
                          <span
                            class="unit-score-pill"
                            :class="{
                              'score-pass': st.scores[l.id] !== undefined && st.scores[l.id] !== null && st.scores[l.id] >= 60,
                              'score-fail': st.scores[l.id] !== undefined && st.scores[l.id] !== null && st.scores[l.id] < 60,
                              'score-empty': st.scores[l.id] === undefined || st.scores[l.id] === null
                            }"
                          >
                            {{ st.scores[l.id] !== undefined && st.scores[l.id] !== null ? st.scores[l.id] : '—' }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 主工作區：公告管理視圖 -->
    <AdminAnnouncementManager v-else-if="currentViewMode === 'announcements'" />

    <!-- 學生詳細單元評分與作答抽屜/彈窗 -->
    <transition name="sys-modal" :duration="450">
      <div v-if="selectedDetailStudent" class="modal-overlay" @click.self="selectedDetailStudent = null">
        <div class="modal-box modal-lg">
          <div class="modal-header">
            <div>
              <span class="section-kicker">學生詳細成績管理</span>
              <h3>【{{ selectedDetailStudent.name }} ({{ selectedDetailStudent.studentId }})】各單元評分與記錄</h3>
            </div>
          </div>
          <div class="modal-body">
            <div class="detail-overview-bar">
              <span>累積上線時長：<strong>{{ selectedDetailStudent.onlineDurationMinutes }} 分鐘</strong></span>
              <span>最近活躍：<strong>{{ formatDate(selectedDetailStudent.lastSeenAt) }}</strong></span>
              <span>已完成題數：<strong>{{ getStudentCourseCompletedCount(selectedDetailStudent) }} / {{ gradeLessons.length }}</strong></span>
            </div>

            <div class="detail-lessons-list">
              <div v-for="(l, index) in gradeLessons" :key="l.id" class="detail-lesson-row">
                <div class="detail-lesson-title">
                  <span class="lesson-badge">單元 {{ l.number ?? index + 1 }}</span>
                  <strong>{{ l.title }}</strong>
                </div>
                <div class="detail-lesson-inputs">
                  <label class="detail-check-label">
                    <input
                      type="checkbox"
                      v-model="selectedDetailStudent.completedLessons[l.id]"
                      @change="selectedDetailStudent.isDirty = true"
                    />
                    <span>標記完成</span>
                  </label>
                  <div class="detail-score-box">
                    <label>得分：</label>
                    <span
                      class="detail-score-display"
                      :class="{
                        'score-pass': selectedDetailStudent.scores[l.id] !== undefined && selectedDetailStudent.scores[l.id] !== null && selectedDetailStudent.scores[l.id] >= 60,
                        'score-fail': selectedDetailStudent.scores[l.id] !== undefined && selectedDetailStudent.scores[l.id] !== null && selectedDetailStudent.scores[l.id] < 60
                      }"
                    >
                      {{ selectedDetailStudent.scores[l.id] !== undefined && selectedDetailStudent.scores[l.id] !== null ? `${selectedDetailStudent.scores[l.id]} 分` : '未評分' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" @click="selectedDetailStudent = null">關閉</button>
            <button class="btn btn-primary" @click="closeStudentDetail">💾 儲存此學生紀錄</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 階段管理彈窗 (Stage Modal) -->
    <transition name="sys-modal" :duration="450">
      <div v-if="showStageModal" class="modal-overlay" @click.self="showStageModal = false">
        <div class="modal-box">
          <div class="modal-header">
            <h3>課程階段管理 (Stages)</h3>
          </div>

          <div class="modal-body">
            <div class="add-stage-form">
              <input
                v-model="newStageTitle"
                placeholder="新增階段名稱 (例如: 階段六 · 進階前端框架)"
                class="input-control"
                @keyup.enter="handleAddStage"
              />
              <button class="btn btn-primary" @click="handleAddStage">新增</button>
            </div>

            <div class="stage-list">
              <div v-for="s in stages" :key="s.id" class="stage-item-row">
                <span class="stage-id-badge">ID: {{ s.id }}</span>
                <input
                  v-model="s.title"
                  class="input-control stage-title-edit"
                  @change="updateStage(s.id, s.title)"
                />
                <span class="stage-count">
                  ({{ lessons.filter(l => l.stage === s.id).length }} 單元)
                </span>
                <button
                  class="btn-icon-danger"
                  title="刪除階段"
                  @click="handleDeleteStage(s.id)"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-primary" @click="showStageModal = false">完成</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 匯出 lessons.ts 程式碼彈窗 (Export Modal) -->
    <transition name="sys-modal" :duration="450">
      <div v-if="showExportModal" class="modal-overlay" @click.self="showExportModal = false">
        <div class="modal-box modal-lg">
          <div class="modal-header">
            <h3>匯出 src/lessons.ts 原始碼</h3>
          </div>

          <div class="modal-body">
            <p class="export-tip">
              下方已將您目前的教材與階段資料自動生成為標準的 TypeScript 原始碼。您可以直接下載檔案或複製全部代碼，取代專案內的
              <code>src/lessons.ts</code>，即可永久儲存至程式庫並提交 Git！
            </p>

          <div class="export-actions-bar">
            <button class="btn btn-primary" @click="copyExportedCode">
              {{ copySuccess ? '✓ 已複製到剪貼簿！' : '📋 複製全部程式碼' }}
            </button>
            <button class="btn btn-secondary" @click="downloadLessonsTs">
              ⬇️ 直接下載 lessons.ts 檔案
            </button>
          </div>

          <textarea
            v-model="exportedCode"
            readonly
            rows="18"
            class="input-control code-editor export-textarea"
            spellcheck="false"
          ></textarea>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="showExportModal = false">關閉</button>
        </div>
      </div>
    </div>
    </transition>

    <!-- 助教端訊息管理抽屜面板 -->
    <TaChatDrawer
      :is-open="isTaChatOpen"
      @close="isTaChatOpen = false"
      @unread-update="taUnreadCount = $event"
    />
  </div>
</template>
