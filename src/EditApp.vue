<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'

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

const baseUrl = import.meta.env.BASE_URL

// 權限驗證狀態
const isAuthenticated = ref(isEditorAuthenticated())
const inputPassword = ref('')
const authError = ref('')
const isVerifying = ref(false)

async function handleLogin() {
  if (!inputPassword.value) {
    authError.value = '請輸入管理密碼！'
    return
  }
  isVerifying.value = true
  authError.value = ''
  try {
    const res = await verifyEditorPassword(inputPassword.value)
    if (res.success) {
      isAuthenticated.value = true
      inputPassword.value = ''
      loadStudentsData()
    } else {
      authError.value = res.message
    }
  } catch (err: any) {
    authError.value = err?.message || '驗證失敗'
  } finally {
    isVerifying.value = false
  }
}

onMounted(() => {
  if (isAuthenticated.value) {
    loadStudentsData()
  }
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

const currentViewMode = ref<'lessons' | 'grades'>('lessons')
const studentsList = ref<StudentAdminRecord[]>([])
const isLoadingStudents = ref(false)
const studentSearchKeyword = ref('')
const selectedDetailStudent = ref<StudentAdminRecord | null>(null)
const saveSuccessMessage = ref('')
const isSavingAll = ref(false)

function switchViewToGrades() {
  currentViewMode.value = 'grades'
  if (studentsList.value.length === 0) {
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

const overallAverageScore = computed(() => {
  const scored = studentsList.value.filter((s) => s.averageScore > 0)
  if (!scored.length) return 0
  const total = scored.reduce((sum, s) => sum + s.averageScore, 0)
  return Math.round(total / scored.length)
})

async function loadStudentsData() {
  isLoadingStudents.value = true
  try {
    const res = await fetch('/api/admin/students')
    if (res.ok) {
      const data = await res.json()
      studentsList.value = data.map((s: any) => ({
        ...s,
        scores: s.scores || {},
        completedLessons: s.completedLessons || {},
        isDirty: false,
      }))
    } else {
      await loadStudentsFallback()
    }
  } catch {
    await loadStudentsFallback()
  } finally {
    isLoadingStudents.value = false
  }
}

async function loadStudentsFallback() {
  // 從 Supabase 與本地 COURSE_MEMBERS 合併
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

  try {
    const { data: subs } = await supabase.from('practice_submissions').select('*')
    if (subs) {
      for (const sub of subs) {
        if (sub.student_id === '__SYSTEM_COURSE_DATA__') continue
        const normId = (sub.student_id || '').toLowerCase()
        let st = memberMap.get(normId)
        if (!st) {
          st = {
            studentId: sub.student_id,
            name: sub.student_name,
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
        
        // 優先從獨立欄位讀取，若無則從 code.__meta 解析（相容尚未擴展 schema 的資料庫）
        let subScore = typeof sub.score === 'number' ? sub.score : null
        let subCompleted = typeof sub.completed === 'boolean' ? sub.completed : null
        let subDuration = typeof sub.online_duration_minutes === 'number' ? sub.online_duration_minutes : null

        if (subScore === null || subCompleted === null) {
          try {
            const parsedCode = JSON.parse(sub.code || '{}')
            if (parsedCode.__meta) {
              if (subScore === null && typeof parsedCode.__meta.score === 'number') subScore = parsedCode.__meta.score
              if (subCompleted === null && typeof parsedCode.__meta.completed === 'boolean') subCompleted = parsedCode.__meta.completed
              if (subDuration === null && typeof parsedCode.__meta.online_duration_minutes === 'number') subDuration = parsedCode.__meta.online_duration_minutes
            }
          } catch {}
        }

        if (subScore && subScore > 0) {
          st.scores[sub.lesson_id] = Math.max(st.scores[sub.lesson_id] || 0, subScore)
        }
        if (subCompleted) {
          st.completedLessons[sub.lesson_id] = true
        }
        if (subDuration) {
          st.onlineDurationMinutes = Math.max(st.onlineDurationMinutes, subDuration)
        }
        if (!st.lastSeenAt || new Date(sub.created_at) > new Date(st.lastSeenAt)) {
          st.lastSeenAt = sub.created_at
        }
      }
    }
  } catch (err) {
    console.warn('載入 Supabase 紀錄略過：', err)
  }

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
  const headers = ['學號', '姓名', '最近上線時間', '累積上線時長(分鐘)', '已完成單元數', '平均成績']
  const lessonIds = lessons.value.map((l) => l.id)
  lessonIds.forEach((id) => headers.push(`單元${id}成績`))

  const rows = studentsList.value.map((st) => {
    const row = [
      `"${st.studentId}"`,
      `"${st.name}"`,
      `"${st.lastSeenAt ? new Date(st.lastSeenAt).toLocaleString() : '未上線'}"`,
      st.onlineDurationMinutes,
      st.completedCount,
      st.averageScore,
    ]
    lessonIds.forEach((id) => row.push(st.scores[id] ?? 0))
    return row.join(',')
  })

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `WebCraft_學生修課成績單_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}


// 當前選取的單元 ID
const selectedLessonId = ref<string>(lessons.value[0]?.id || '')

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

// Tab 切換 (練習碼與參考答案)
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
let courseAutoSaveTimer: ReturnType<typeof setTimeout> | null = null

async function handleSaveCourseToDb() {
  courseSaveStatus.value = '正在儲存教材至雲端資料庫...'
  const res = await saveCourseDataToDatabase()
  if (res.success) {
    courseSaveStatus.value = '教材已成功儲存至雲端資料庫！全班學生重新整理即可載入。'
  } else {
    courseSaveStatus.value = res.message
  }
  setTimeout(() => {
    courseSaveStatus.value = ''
  }, 4000)
}

async function handleReloadCourseFromDb() {
  courseSaveStatus.value = '正在從雲端資料庫讀取最新教材...'
  const ok = await syncCourseDataFromDatabase()
  if (ok) {
    courseSaveStatus.value = '已成功從雲端資料庫更新最新教材！'
  } else {
    courseSaveStatus.value = '目前無法自雲端取得更新，已保持本機內容。'
  }
  setTimeout(() => {
    courseSaveStatus.value = ''
  }, 4000)
}

// 深度監聽目前編輯的內容，自動觸發儲存與 iframe 同步，並防抖上傳資料庫
watch(
  [stages, lessons],
  () => {
    saveCourseData()
    syncToIframe()
    if (courseAutoSaveTimer) clearTimeout(courseAutoSaveTimer)
    courseAutoSaveTimer = setTimeout(() => {
      saveCourseDataToDatabase()
    }, 2000)
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
  if (previewIframe.value) {
    previewIframe.value.src = `${baseUrl}index.html?lesson=${selectedLessonId.value}&t=${Date.now()}`
  }
}

// ================== 單元操作 ==================
function handleAddLesson() {
  const currentStage = currentLesson.value?.stage || stages.value[0]?.id || 1
  const newL = createEmptyLesson(currentStage)
  addLesson(newL)
  selectedLessonId.value = newL.id
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
    <div v-if="!isAuthenticated" class="modal-overlay auth-lock-overlay">
      <div class="modal-box auth-lock-box">
        <div class="modal-header">
          <div class="auth-title">
            <span class="lock-icon">🔐</span>
            <h3>教材編輯器身分驗證</h3>
          </div>
        </div>
        <form class="modal-body auth-lock-body" @submit.prevent="handleLogin">
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
              autofocus
            />
          </div>
          <p v-if="authError" class="auth-error-msg" role="alert">{{ authError }}</p>
          <div class="auth-actions">
            <button class="btn btn-primary btn-block" type="submit" :disabled="isVerifying">
              {{ isVerifying ? '驗證中...' : '🔓 解鎖編輯功能' }}
            </button>
            <a :href="baseUrl" class="btn btn-outline btn-block text-center">返回學習頁面</a>
          </div>
        </form>
      </div>
    </div>

    <!-- 頂部工具導航列 -->
    <header class="editor-header">
      <div class="editor-brand">
        <div class="brand-mark">&lt;/&gt;</div>
        <div>
          <strong>WebCraft 管理員模式</strong>
          <span>教材編輯與學生成績／上線管理</span>
        </div>
      </div>

      <!-- 管理員模式視圖切換標籤 -->
      <div class="admin-mode-tabs">
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: currentViewMode === 'lessons' }"
          @click="currentViewMode = 'lessons'"
        >
          <svg class="btn-svg" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          教材內容編輯
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
          學生練習成績與上線管理
        </button>
      </div>

      <div class="editor-header-actions">
        <template v-if="currentViewMode === 'lessons'">
          <button class="btn btn-outline" @click="showStageModal = true">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            階段管理 ({{ stages.length }})
          </button>
          <button class="btn btn-primary" @click="handleAddLesson">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            新增單元
          </button>

          <button class="btn btn-primary" :disabled="isSyncingCourseData" @click="handleSaveCourseToDb" title="將所有課程教材同步儲存至雲端資料庫，跨裝置與全班即刻生效">
            <svg class="btn-svg" :class="{ 'btn-spin': isSyncingCourseData }" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            {{ isSyncingCourseData ? '雲端儲存中...' : '儲存教材至資料庫' }}
          </button>

          <button class="btn btn-outline" :disabled="isSyncingCourseData" @click="handleReloadCourseFromDb" :title="lastSyncTime ? `上次同步時間：${new Date(lastSyncTime).toLocaleTimeString()}` : '自雲端重新載入教材'">
            <svg class="btn-svg" :class="{ 'btn-spin': isSyncingCourseData }" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            雲端重新整理
          </button>

          <div class="divider"></div>

          <button class="btn btn-secondary" @click="openExportModal">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            匯出 lessons.ts
          </button>
          <label class="btn btn-outline file-label" title="選擇本機 lessons.ts 檔案進行匯入">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            匯入 lessons.ts
            <input type="file" accept=".ts,.js" style="display: none" @change="handleImportTs" />
          </label>
          <button class="btn btn-danger-outline" @click="handleResetDefault">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            還原預設
          </button>
        </template>

        <template v-else-if="currentViewMode === 'grades'">
          <button class="btn btn-primary" :disabled="isSavingAll" @click="saveAllDirtyStudents">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            儲存修改 ({{ studentsList.filter(s => s.isDirty).length }})
          </button>
          <button class="btn btn-secondary" @click="exportStudentsCsv">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            匯出成績 CSV
          </button>
          <button class="btn btn-outline" :disabled="isLoadingStudents" @click="loadStudentsData">
            <svg class="btn-svg" :class="{ 'btn-spin': isLoadingStudents }" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {{ isLoadingStudents ? '載入中...' : '重新整理' }}
          </button>
        </template>

        <div class="divider"></div>

        <button class="btn btn-outline" title="鎖定編輯器" @click="handleLock">
          <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          鎖定
        </button>

        <a :href="baseUrl" target="_blank" class="btn btn-link">
          <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          開啟學習頁面
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
            <span>單元列表 (共 {{ lessons.length }} 單元)</span>
            <button class="btn-text-sm" @click="sidebarCollapsed = !sidebarCollapsed">
              {{ sidebarCollapsed ? '展開列表 ▾' : '收合列表 ▴' }}
            </button>
          </div>

          <div v-show="!sidebarCollapsed" class="nav-pills-container">
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
        </div>

        <!-- 單元詳細編輯表單 -->
        <div v-if="currentLesson" class="form-container">
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
      </section>

      <!-- 右欄：即時預覽 index.html -->
      <section class="editor-right-pane">
        <div class="preview-header-bar">
          <div class="preview-title-tag">
            <span class="live-dot"></span>
            <strong>即時外觀預覽 (index.html)</strong>
            <small>左側編輯自動無延遲套用</small>
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

            <button class="btn-icon" title="重整預覽" @click="reloadPreview">
              🔄
            </button>
          </div>
        </div>

        <div class="iframe-container-wrapper" :class="previewDevice">
          <iframe
            ref="previewIframe"
            :src="`${baseUrl}index.html?lesson=${selectedLessonId}`"
            class="live-preview-frame"
            @load="onIframeLoad"
          ></iframe>
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
            <strong class="metric-value">{{ lessons.length }} 單元</strong>
          </div>
        </div>

        <div class="grades-filter-bar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              v-model="studentSearchKeyword"
              placeholder="搜尋學生姓名或學號..."
              class="input-control"
            />
          </div>
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
        <div v-if="isLoadingStudents" class="grades-loading-state">
          <span>
            <svg class="btn-svg btn-spin" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            正在載入學生名單與成績資料...
          </span>
        </div>
        <table v-else class="grades-data-table">
          <thead>
            <tr>
              <th style="width: 120px">學號</th>
              <th style="width: 140px">姓名 (可修改)</th>
              <th style="width: 160px">最近上線時間</th>
              <th style="width: 140px">上線時長</th>
              <th style="width: 120px">完成進度</th>
              <th style="width: 110px">平均分數</th>
              <th>各單元得分 (可直接修改)</th>
              <th style="width: 140px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="st in filteredStudents"
              :key="st.studentId"
              :class="{ 'row-dirty': st.isDirty }"
            >
              <td>
                <span class="student-id-code">{{ st.studentId }}</span>
              </td>
              <td>
                <input
                  v-model="st.name"
                  class="input-control table-input"
                  placeholder="姓名"
                  @input="st.isDirty = true"
                />
              </td>
              <td>
                <span class="last-seen-tag" :class="{ 'is-active': st.lastSeenAt }">
                  {{ formatDate(st.lastSeenAt) }}
                </span>
              </td>
              <td>
                <div class="duration-input-wrapper">
                  <input
                    type="number"
                    min="0"
                    v-model.number="st.onlineDurationMinutes"
                    class="input-control table-input duration-input"
                    @input="st.isDirty = true"
                  />
                  <span>分</span>
                </div>
              </td>
              <td>
                <span class="progress-badge">
                  {{ st.completedCount }} / {{ lessons.length }}
                </span>
              </td>
              <td>
                <strong class="score-text" :class="{ 'score-high': st.averageScore >= 80, 'score-low': st.averageScore < 60 && st.averageScore > 0 }">
                  {{ st.averageScore > 0 ? `${st.averageScore} 分` : '—' }}
                </strong>
              </td>
              <td>
                <!-- 橫向滑動展示各單元成績輸入框 -->
                <div class="unit-scores-scroll">
                  <div
                    v-for="l in lessons"
                    :key="l.id"
                    class="unit-score-item"
                    :title="`${l.title} (單元 ${l.number})`"
                  >
                    <span class="unit-label">{{ l.number }}</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="—"
                      v-model.number="st.scores[l.id]"
                      class="unit-score-input"
                      @input="st.isDirty = true"
                    />
                  </div>
                </div>
              </td>
              <td>
                <div class="table-actions">
                  <button
                    class="btn btn-sm btn-primary"
                    :disabled="!st.isDirty"
                    @click="saveStudent(st)"
                  >
                    <svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    儲存
                  </button>
                  <button
                    class="btn btn-sm btn-outline"
                    @click="openStudentDetail(st)"
                    title="查看該學生詳細作答與各題評分"
                  >
                    <svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    細項
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 學生詳細單元評分與作答抽屜/彈窗 -->
    <div v-if="selectedDetailStudent" class="modal-overlay" @click.self="selectedDetailStudent = null">
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <div>
            <span class="section-kicker">學生詳細成績管理</span>
            <h3>【{{ selectedDetailStudent.name }} ({{ selectedDetailStudent.studentId }})】各單元評分與記錄</h3>
          </div>
          <button class="modal-close" @click="selectedDetailStudent = null">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="detail-overview-bar">
            <span>累積上線時長：<strong>{{ selectedDetailStudent.onlineDurationMinutes }} 分鐘</strong></span>
            <span>最近活躍：<strong>{{ formatDate(selectedDetailStudent.lastSeenAt) }}</strong></span>
            <span>已完成題數：<strong>{{ selectedDetailStudent.completedCount }} / {{ lessons.length }}</strong></span>
          </div>

          <div class="detail-lessons-list">
            <div v-for="l in lessons" :key="l.id" class="detail-lesson-row">
              <div class="detail-lesson-title">
                <span class="lesson-badge">單元 {{ l.number }}</span>
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
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="未評分"
                    v-model.number="selectedDetailStudent.scores[l.id]"
                    class="input-control score-number-input"
                    @input="selectedDetailStudent.isDirty = true"
                  />
                  <span>分</span>
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

    <!-- 階段管理彈窗 (Stage Modal) -->
    <div v-if="showStageModal" class="modal-overlay" @click.self="showStageModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <h3>課程階段管理 (Stages)</h3>
          <button class="modal-close" @click="showStageModal = false">✕</button>
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

    <!-- 匯出 lessons.ts 程式碼彈窗 (Export Modal) -->
    <div v-if="showExportModal" class="modal-overlay" @click.self="showExportModal = false">
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <h3>匯出 src/lessons.ts 原始碼</h3>
          <button class="modal-close" @click="showExportModal = false">✕</button>
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
  </div>
</template>
