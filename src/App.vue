<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { lessons, stages, type Lesson } from './courseStore'
import { supabase } from './supabase'
import { renderMarkdown, renderInlineMarkdown } from './markdown'
import { verifyCourseMember } from './memberService'
import { verifyPracticeWithAI, type AiVerificationResult, getTaiwanTimeString } from './aiService'
import MathCurveLoader from './components/MathCurveLoader.vue'

const baseUrl = import.meta.env.BASE_URL
const contentRef = ref<HTMLElement | null>(null)

function scrollContentToTop() {
  if (contentRef.value) {
    contentRef.value.scrollTo(0, 0)
    contentRef.value.scrollTop = 0
    contentRef.value.scrollLeft = 0
  }
}

const selectedLessonId = ref(localStorage.getItem('selected-lesson') || (lessons.value[0]?.id || '1-1'))
const activePanel = ref<'html' | 'css' | 'js'>('html')
const savedProgress = JSON.parse(localStorage.getItem('completed-levels') || '{}') as Record<string, boolean | boolean[]>
const completedLessons = ref<Record<string, boolean>>(
  Object.fromEntries(Object.entries(savedProgress).map(([id, value]) => [id, Array.isArray(value) ? value.some(Boolean) : value])),
)
const studentId = ref(localStorage.getItem('webcraft-student-id') || '')
const studentName = ref(localStorage.getItem('webcraft-student-name') || '')
const showStudentProfileModal = ref(!studentId.value.trim() || !studentName.value.trim())
const studentProfileError = ref('')
const isVerifyingProfile = ref(false)
const welcomeMessage = ref('')
let welcomeTimeout: ReturnType<typeof setTimeout> | null = null
const practiceStudents = ref<string[]>([])
const practiceSyncError = ref(false)
const submissionMessage = ref('')
const isAiVerifying = ref(false)
const showServerBusyHint = ref(false)
let serverBusyTimer: ReturnType<typeof setTimeout> | null = null
const aiQueueMessage = ref('')
const aiResult = ref<AiVerificationResult | null>(null)

// AI 驗證多步驟狀態機
const aiVerificationSteps = [
  '正在解析程式碼語意結構與標籤階層...',
  '正在分析 CSS 樣式與排版約束...',
  '正在推演 JavaScript 互動動態與執行狀態...',
  '正在生成專屬學習回饋與診斷評分...',
]
const currentAiStepIndex = ref(0)
let aiStepTimer: ReturnType<typeof setInterval> | null = null

// 學生的作答歷史紀錄
export interface SubmissionRecord {
  id?: number | string
  student_id: string
  student_name: string
  lesson_id: string
  score: number
  completed: boolean
  ai_feedback?: string
  submitted_at_tw?: string
  created_at?: string
  code?: string
}

const currentLessonSubmissions = ref<SubmissionRecord[]>([])
const showHistoryModal = ref(false)
const isLoadingHistory = ref(false)
const historyModalBodyRef = ref<HTMLElement | null>(null)
let historyResizeObserver: ResizeObserver | null = null

const historyScrollState = ref({
  hasScroll: false,
  topTranslateY: -50,
  bottomTranslateY: 50,
})

function updateHistoryModalScroll() {
  const el = historyModalBodyRef.value
  if (!el) return

  const scrollTop = el.scrollTop
  const scrollHeight = el.scrollHeight
  const clientHeight = el.clientHeight
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  const hasScroll = maxScroll > 4

  if (!hasScroll) {
    historyScrollState.value = {
      hasScroll: false,
      topTranslateY: -50,
      bottomTranslateY: 50,
    }
    return
  }

  // 上方漸層遮罩：scrollTop 0 -> 50px 對應 translateY -50px -> 0px
  const topProgress = Math.min(1, Math.max(0, scrollTop / 50))
  const topTranslateY = -50 * (1 - topProgress)

  // 底部漸層遮罩：距底部 50px -> 0px 對應 translateY 0px -> 50px
  const distanceFromBottom = Math.max(0, maxScroll - scrollTop)
  const bottomProgress = Math.min(1, Math.max(0, distanceFromBottom / 50))
  const bottomTranslateY = 50 * (1 - bottomProgress)

  historyScrollState.value = {
    hasScroll: true,
    topTranslateY,
    bottomTranslateY,
  }
}

const historyMaskStyle = computed(() => {
  if (!historyScrollState.value.hasScroll) {
    return {
      WebkitMaskImage: 'none',
      maskImage: 'none',
    }
  }

  const { topTranslateY, bottomTranslateY } = historyScrollState.value
  // 上方遮罩隨 scrollTop 0 -> 50px，translateY 從 -50px -> 0px
  // 底部遮罩隨距離底部 50px -> 0px，translateY 從 0px -> 50px（平滑滑出視口）
  const topStart = Number(topTranslateY.toFixed(1))
  const topEnd = Number((topTranslateY + 50).toFixed(1))
  const bottomStart = Number((50 - bottomTranslateY).toFixed(1))
  const bottomEnd = Number(bottomTranslateY.toFixed(1))

  const maskValue = `linear-gradient(to bottom, transparent ${topStart}px, #000000 ${topEnd}px, #000000 calc(100% - ${bottomStart}px), transparent calc(100% + ${bottomEnd}px))`

  return {
    WebkitMaskImage: maskValue,
    maskImage: maskValue,
  }
})

watch(
  () => showHistoryModal.value,
  async (isOpen) => {
    if (isOpen) {
      await nextTick()
      updateHistoryModalScroll()

      if (historyModalBodyRef.value && typeof ResizeObserver !== 'undefined') {
        historyResizeObserver?.disconnect()
        historyResizeObserver = new ResizeObserver(() => {
          updateHistoryModalScroll()
        })
        historyResizeObserver.observe(historyModalBodyRef.value)
      }
    } else {
      historyResizeObserver?.disconnect()
      historyResizeObserver = null
    }
  },
)

watch(
  [() => isLoadingHistory.value, () => currentLessonSubmissions.value],
  async () => {
    if (showHistoryModal.value) {
      await nextTick()
      updateHistoryModalScroll()
    }
  },
  { deep: true },
)

const highestScore = computed(() => {
  if (currentLessonSubmissions.value.length === 0) return 0
  return Math.max(...currentLessonSubmissions.value.map((s) => s.score || 0))
})

const submissionCount = computed(() => {
  return currentLessonSubmissions.value.length
})

const lesson = computed<Lesson>(() => lessons.value.find((item) => item.id === selectedLessonId.value) || lessons.value[0])
const practice = computed(() => lesson.value?.practice || { instructions: '', starterCode: { html: '', css: '', js: '' }, checklist: [], answer: { html: '', css: '', js: '' } })
const code = ref({ ...practice.value.starterCode })
const isCurrentComplete = computed(() => (lesson.value ? completedLessons.value[lesson.value.id] || false : false))
const completedCount = computed(() => Object.values(completedLessons.value).filter(Boolean).length)
const progress = computed(() => (lessons.value.length ? Math.round((completedCount.value / lessons.value.length) * 100) : 0))

async function loadCurrentLessonSubmissions() {
  const trimmedId = studentId.value.trim()
  if (!trimmedId || !lesson.value) {
    currentLessonSubmissions.value = []
    return
  }

  isLoadingHistory.value = true
  try {
    const { data, error } = await supabase
      .from('practice_submissions')
      .select('*')
      .eq('student_id', trimmedId)
      .eq('lesson_id', lesson.value.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      currentLessonSubmissions.value = data.map((item: any) => {
        let meta = null
        try {
          if (typeof item.code === 'string' && item.code.startsWith('{')) {
            const parsed = JSON.parse(item.code)
            meta = parsed.__meta
          }
        } catch {}

        const twTime =
          item.submitted_at_tw ||
          meta?.submitted_at_tw ||
          (item.created_at ? getTaiwanTimeString(new Date(item.created_at)) : '')
        const finalScore = typeof item.score === 'number' ? item.score : (meta?.score || 0)
        const finalFeedback = item.ai_feedback || meta?.ai_feedback || ''
        const finalCompleted = Boolean(item.completed || meta?.completed)

        return {
          ...item,
          score: finalScore,
          completed: finalCompleted,
          ai_feedback: finalFeedback,
          submitted_at_tw: twTime,
        }
      })
    }
  } catch (err) {
    console.warn('載入作答歷史失敗：', err)
  } finally {
    isLoadingHistory.value = false
  }
}

watch(selectedLessonId, async () => {
  aiResult.value = null
  aiQueueMessage.value = ''
  if (lesson.value?.practice) {
    code.value = { ...lesson.value.practice.starterCode }
  }
  localStorage.setItem('selected-lesson', selectedLessonId.value)
  refreshPracticeStudents()
  loadCurrentLessonSubmissions()
  scrollContentToTop()
  await nextTick()
  scrollContentToTop()
})

watch(
  () => lesson.value?.practice?.starterCode,
  (newStarter) => {
    if (newStarter) {
      code.value = { ...newStarter }
    }
  },
  { deep: true },
)

watch(completedLessons, (value) => localStorage.setItem('completed-levels', JSON.stringify(value)), { deep: true })

const expandedStages = ref<Record<number, boolean>>({
  1: true,
  2: true,
  3: true,
  4: true,
  5: true,
})

function toggleStage(stageId: number | string) {
  const numericId = Number(stageId)
  expandedStages.value[numericId] = !expandedStages.value[numericId]
}

watch(
  () => lesson.value?.stage,
  (stageId) => {
    if (stageId != null) {
      expandedStages.value[Number(stageId)] = true
    }
  },
  { immediate: true },
)

function chooseLesson(id: string) {
  selectedLessonId.value = id
  scrollContentToTop()
}

function goToNextLesson() {
  const currentIndex = lessons.value.findIndex((item) => item.id === lesson.value?.id)
  if (currentIndex !== -1 && currentIndex < lessons.value.length - 1) {
    chooseLesson(lessons.value[currentIndex + 1].id)
  }
}

const isLastLesson = computed(() => {
  if (!lesson.value || !lessons.value.length) return true
  return lesson.value.id === lessons.value[lessons.value.length - 1].id
})


function resetCode() {
  if (practice.value) {
    code.value = { ...practice.value.starterCode }
    aiResult.value = null
    aiQueueMessage.value = ''
  }
}

function panelHasError(panel: 'html' | 'css' | 'js'): boolean {
  return Boolean(aiResult.value?.errors.some((e) => e.panel === panel))
}

async function runAiVerification() {
  const trimmedId = studentId.value.trim()
  const trimmedName = studentName.value.trim()

  if (!trimmedId || !trimmedName) {
    showStudentProfileModal.value = true
    studentProfileError.value = '請先填寫並驗證學號與姓名後，再進行驗證答案！'
    return
  }

  isAiVerifying.value = true
  aiQueueMessage.value = ''
  aiResult.value = null
  submissionMessage.value = ''
  showServerBusyHint.value = false

  currentAiStepIndex.value = 0
  if (aiStepTimer) clearInterval(aiStepTimer)
  aiStepTimer = setInterval(() => {
    if (currentAiStepIndex.value < aiVerificationSteps.length - 1) {
      currentAiStepIndex.value++
    }
  }, 1600)

  if (serverBusyTimer) clearTimeout(serverBusyTimer)
  serverBusyTimer = setTimeout(() => {
    if (isAiVerifying.value) {
      showServerBusyHint.value = true
    }
  }, 2000)

  try {
    const result = await verifyPracticeWithAI(
      {
        studentId: trimmedId,
        studentName: trimmedName,
        lessonId: lesson.value.id,
        lessonTitle: lesson.value.title,
        lessonObjective: lesson.value.objective,
        instructions: practice.value.instructions,
        checklist: practice.value.checklist,
        starterCode: practice.value.starterCode,
        answerCode: practice.value.answer,
        studentCode: code.value,
      },
      (queueMsg) => {
        aiQueueMessage.value = queueMsg
      },
    )

    aiResult.value = result

    if (result.passed) {
      completedLessons.value = { ...completedLessons.value, [lesson.value.id]: true }
      syncPractice(true)
      submissionMessage.value = '🎉 恭喜！實作練習已成功通過審核，已為你標記完成！'
      aiQueueMessage.value = ''
    }
  } catch (error: any) {
    console.error('驗證失敗：', error)
  } finally {
    isAiVerifying.value = false
    if (aiStepTimer) {
      clearInterval(aiStepTimer)
      aiStepTimer = null
    }
    if (serverBusyTimer) clearTimeout(serverBusyTimer)
    showServerBusyHint.value = false
    setTimeout(() => {
      loadCurrentLessonSubmissions()
    }, 400)
  }
}

async function confirmStudentProfile() {
  const trimmedStudentId = studentId.value.trim()
  const trimmedStudentName = studentName.value.trim()
  if (!trimmedStudentId || !trimmedStudentName) {
    studentProfileError.value = '請輸入學號與姓名後再開始練習。'
    return
  }

  isVerifyingProfile.value = true
  studentProfileError.value = ''

  try {
    const res = await verifyCourseMember(trimmedStudentId, trimmedStudentName)
    if (!res.valid) {
      studentProfileError.value = res.error || '錯誤！你目前沒有在課程中，請檢查你的學號/姓名是否正確！'
      return
    }

    studentId.value = res.member?.studentId || trimmedStudentId
    studentName.value = res.member?.name || trimmedStudentName
    localStorage.setItem('webcraft-student-id', studentId.value)
    localStorage.setItem('webcraft-student-name', studentName.value)
    localStorage.setItem('webcraft-student-profile-completed', 'true')
    studentProfileError.value = ''
    showStudentProfileModal.value = false

    welcomeMessage.value = `🎉 歡迎，${studentName.value} 同學！身分驗證成功，祝你學習愉快！`
    if (welcomeTimeout) clearTimeout(welcomeTimeout)
    welcomeTimeout = setTimeout(() => {
      welcomeMessage.value = ''
    }, 6000)

    loadCurrentLessonSubmissions()
  } catch (error) {
    console.error('驗證身分出錯：', error)
    studentProfileError.value = '身分驗證發生異常，請稍後再試！'
  } finally {
    isVerifyingProfile.value = false
  }
}

function closeStudentProfileModal() {
  if (studentId.value.trim() && studentName.value.trim()) {
    showStudentProfileModal.value = false
  }
}

async function syncPractice(completed = false) {
  if (!studentId.value.trim() || !studentName.value.trim() || !lesson.value) return
  localStorage.setItem('webcraft-student-name', studentName.value.trim())
  localStorage.setItem('webcraft-student-id', studentId.value.trim())
  try {
    const { error } = await supabase.from('practice_submissions').insert({
      student_id: studentId.value.trim(),
      student_name: studentName.value.trim(),
      lesson_id: lesson.value.id,
      code: JSON.stringify(code.value),
      completed,
    })
    if (error) {
      // 備援：若資料庫尚未新增 completed 欄位，存入 code.__meta
      await supabase.from('practice_submissions').insert({
        student_id: studentId.value.trim(),
        student_name: studentName.value.trim(),
        lesson_id: lesson.value.id,
        code: JSON.stringify({ ...code.value, __meta: { completed } }),
      })
    }
    practiceSyncError.value = false
    await refreshPracticeStudents()
  } catch {
    practiceSyncError.value = false // 不對學生顯示錯誤
  }
}

async function refreshPracticeStudents() {
  if (!lesson.value) return
  try {
    const { data, error } = await supabase
      .from('practice_submissions')
      .select('student_name')
      .eq('lesson_id', lesson.value.id)
      .neq('student_id', '__SYSTEM_COURSE_DATA__')
      .order('created_at', { ascending: false })
    if (error) throw error
    practiceStudents.value = [...new Set((data ?? []).map((student) => student.student_name))]
    practiceSyncError.value = false
  } catch {
    practiceSyncError.value = true
  }
}

function handleWindowMessage(event: MessageEvent) {
  if (event.data?.type === 'SELECT_LESSON' && event.data.id) {
    if (lessons.value.some((item) => item.id === event.data.id)) {
      selectedLessonId.value = event.data.id
    }
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showHistoryModal.value) showHistoryModal.value = false
    if (showStudentProfileModal.value && studentId.value.trim() && studentName.value.trim()) {
      showStudentProfileModal.value = false
    }
  }
}

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const queryLesson = urlParams.get('lesson')
  if (queryLesson && lessons.value.some((item) => item.id === queryLesson)) {
    selectedLessonId.value = queryLesson
  }
  window.addEventListener('message', handleWindowMessage)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updateHistoryModalScroll, { passive: true })
  refreshPracticeStudents()
  loadCurrentLessonSubmissions()
})

onUnmounted(() => {
  window.removeEventListener('message', handleWindowMessage)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateHistoryModalScroll)
  historyResizeObserver?.disconnect()
  historyResizeObserver = null
  if (serverBusyTimer) clearTimeout(serverBusyTimer)
  if (aiStepTimer) clearInterval(aiStepTimer)
})

const previewDocument = computed(() => `<!doctype html>
<html lang="zh-Hant">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${code.value.css}</style></head>
<body>${code.value.html}<script>${code.value.js.replace(/<\//g, '<\\/')}<\/script></body></html>`)
</script>

<template>
  <div v-if="lesson" class="app-shell">
    <!-- 歡迎訊息 Toast -->
    <transition name="fade">
      <div v-if="welcomeMessage" class="welcome-toast" role="status" aria-live="polite">
        <div class="welcome-toast-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="welcome-toast-content">
          <strong>{{ welcomeMessage }}</strong>
        </div>
        <button class="welcome-toast-close" type="button" @click="welcomeMessage = ''" aria-label="關閉歡迎訊息">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </transition>

    <transition name="sys-modal" :duration="450">
      <div
        v-if="showStudentProfileModal"
        class="modal-overlay student-profile-overlay"
        @click.self="closeStudentProfileModal"
      >
        <form class="modal-box student-profile-modal" @submit.prevent="confirmStudentProfile">
          <div class="modal-header">
            <div>
              <span class="section-kicker">身分驗證</span>
              <h3>請先驗證你的課程身分</h3>
            </div>
            <button
              v-if="studentId.trim() && studentName.trim()"
              type="button"
              class="history-close-icon-btn"
              @click="showStudentProfileModal = false"
              aria-label="關閉身分驗證視窗"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body student-profile-body">
            <p>請輸入你的學號與姓名以開始練習</p>
            <label for="student-id">學號</label>
            <input
              id="student-id"
              v-model="studentId"
              required
              maxlength="40"
              autocomplete="username"
              placeholder="例如：1132130XX"
              :disabled="isVerifyingProfile"
            />
            <label for="student-name">姓名</label>
            <input
              id="student-name"
              v-model="studentName"
              required
              maxlength="80"
              autocomplete="name"
              placeholder="例如：OOO"
              :disabled="isVerifyingProfile"
            />
            <p v-if="studentProfileError" class="student-profile-error" role="alert">{{ studentProfileError }}</p>
          </div>
          <div class="modal-footer student-profile-footer">
            <button class="complete-button" type="submit" :disabled="isVerifyingProfile">
              <span v-if="isVerifyingProfile">驗證中...</span>
              <span v-else>開始練習</span>
            </button>
          </div>
        </form>
      </div>
    </transition>
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">&lt;/&gt;</div>
        <div><strong>WebCraft</strong><span>軟體工程入門互動練習</span></div>
      </div>
      <div class="top-progress">
        <span>學習進度</span>
        <div class="progress-track"><i :style="{ width: `${progress}%` }"></i></div>
        <b>{{ progress }}%</b>
      </div>
      <button class="ghost-button" @click="chooseLesson(lessons[0].id)">
        <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        回到總覽
      </button>
      <a :href="`${baseUrl}edit.html`" class="edit-nav-button" title="開啟管理員控制台（成績與教材管理）">
        <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        管理員模式
      </a>
    </header>

    <div class="workspace">
      <aside class="sidebar" id="dash-sidebar">
        <div class="side-header">
          <div class="side-logo brand-logo">
            <div class="side-logo-badge">&lt;/&gt;</div>
            <div class="logo-text">課程<span>地圖</span></div>
          </div>
          <span class="side-progress-badge" title="完成進度">{{ completedCount }}/{{ lessons.length }}</span>
        </div>

        <nav class="side-body">
          <div
            v-for="stage in stages"
            :key="stage.id"
            class="stage-group side-nav-group"
            :class="{ expanded: expandedStages[stage.id] }"
          >
            <div class="side-link-row stage-link-row" @click="toggleStage(stage.id)">
              <div class="stage-label">
                <span class="stage-dot" :class="`stage-${stage.id}`"></span>
                <span class="stage-title-text">{{ stage.title }}</span>
              </div>
              <button
                class="sub-list-toggle"
                :title="expandedStages[stage.id] ? '收疊分組' : '展開分組'"
                type="button"
                @click.stop="toggleStage(stage.id)"
              >
                <svg class="toggle-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <line x1="12" y1="5" x2="12" y2="19" class="toggle-vertical-line"></line>
                </svg>
              </button>
            </div>
            <div class="side-sub-list">
              <button
                v-for="item in lessons.filter((entry) => entry.stage === stage.id)"
                :key="item.id"
                class="side-link sub-link lesson-link"
                :class="{ active: item.id === lesson.id }"
                @click="chooseLesson(item.id)"
              >
                <span class="link-glow" aria-hidden="true"></span>
                <span class="lesson-number">{{ item.number }}</span>
                <span class="lesson-title-text sub-text">{{ item.title }}</span>
                <span v-if="completedLessons[item.id]" class="done">
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </nav>

        <div class="side-footer">
          <div
            class="top-avatar"
            @click="showStudentProfileModal = true"
            :title="'目前身分：' + (studentName || '未驗證') + (studentId ? ' (' + studentId + ')' : '') + ' - 點擊變更'"
          >
            {{ studentName ? studentName.trim().charAt(0) : '學' }}
          </div>
          <div
            class="side-footer-info"
            @click="showStudentProfileModal = true"
            style="cursor: pointer;"
            :title="'目前身分：' + (studentName || '未驗證') + (studentId ? ' (' + studentId + ')' : '') + ' - 點擊變更'"
          >
            <span class="side-footer-name">{{ studentName ? `${studentName}${studentId ? ' (' + studentId + ')' : ''}` : '點此驗證身分' }}</span>
            <span class="side-footer-sub">
              <span class="presence-dot-mini"></span>
              {{ practiceStudents.length }} 位同學在線
            </span>
          </div>
        </div>
      </aside>

      <main class="content" ref="contentRef">
        <transition name="lesson-glide" mode="out-in" @before-enter="scrollContentToTop">
          <div :key="lesson.id" class="lesson-view-container">
            <div class="breadcrumb">課程地圖 <span>/</span> {{ stages.find((item) => item.id === lesson.stage)?.title }} <span>/</span> 單元 {{ lesson.number }}</div>
            <section class="lesson-heading">
              <div>
                <div class="eyebrow">CHAPTER {{ String(lesson.number).padStart(2, '0') }} · {{ lesson.type }}</div>
                <h1>{{ lesson.title }}</h1>
                <div class="lesson-objective markdown-content" v-html="renderMarkdown(lesson.objective)"></div>
              </div>
            </section>

            <section class="intro-card">
              <div class="intro-heading"><span class="section-kicker">快速認識</span><span class="intro-label">先掌握關鍵概念，再開始練習</span></div>
              <div class="intro-text markdown-content" v-html="renderMarkdown(lesson.introduction)"></div>
              <div class="concept-list">
                <div v-for="concept in lesson.concepts" :key="concept.name" class="concept-item">
                  <code>{{ concept.name }}</code><span v-html="renderInlineMarkdown(concept.description)"></span>
                </div>
              </div>
            </section>

            <section class="example-card">
              <div class="section-heading"><div><span class="section-kicker">先看範例</span><h2>{{ lesson.example.title }}</h2></div><span class="chip">可執行範例</span></div>
              <div class="example-desc markdown-content" v-html="renderMarkdown(lesson.example.description)"></div>
              <div class="example-code"><pre><code>{{ lesson.example.code }}</code></pre><div class="example-preview" v-html="lesson.example.preview"></div></div>
            </section>

            <section class="challenge-card">
              <div class="challenge-intro">
                <div><span class="section-kicker">實作練習</span><h2>動手做做看</h2><div class="challenge-instructions markdown-content" v-html="renderMarkdown(practice.instructions)"></div></div>
                <button class="reset-button" @click="resetCode">
                  <svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="1 4 1 10 7 10"></polyline>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                  </svg>
                  重設程式碼
                </button>
              </div>

              <!-- AI 佇列排隊提示訊息 -->
              <transition name="fade">
                <div v-if="aiQueueMessage" class="ai-queue-banner" role="status">
                  <span class="queue-pulse"></span>
                  <span>{{ aiQueueMessage }}</span>
                </div>
              </transition>

          <div class="editor-layout">
            <div class="editor-panel">
              <div class="tabs">
                <button :class="{ active: activePanel === 'html', 'tab-has-error': panelHasError('html') }" @click="activePanel = 'html'">
                  <i class="html-dot"></i> HTML
                  <span v-if="panelHasError('html')" class="panel-error-dot" title="HTML 有未通過項目">!</span>
                </button>
                <button :class="{ active: activePanel === 'css', 'tab-has-error': panelHasError('css') }" @click="activePanel = 'css'">
                  <i class="css-dot"></i> CSS
                  <span v-if="panelHasError('css')" class="panel-error-dot" title="CSS 有未通過項目">!</span>
                </button>
                <button :class="{ active: activePanel === 'js', 'tab-has-error': panelHasError('js') }" @click="activePanel = 'js'">
                  <i class="js-dot"></i> JavaScript
                  <span v-if="panelHasError('js')" class="panel-error-dot" title="JS 有未通過項目">!</span>
                </button>
              </div>
              <textarea v-if="activePanel === 'html'" v-model="code.html" spellcheck="false" aria-label="HTML 編輯器" :class="{ 'textarea-has-error': panelHasError('html') }"></textarea>
              <textarea v-else-if="activePanel === 'css'" v-model="code.css" spellcheck="false" aria-label="CSS 編輯器" :class="{ 'textarea-has-error': panelHasError('css') }"></textarea>
              <textarea v-else v-model="code.js" spellcheck="false" aria-label="JavaScript 編輯器" :class="{ 'textarea-has-error': panelHasError('js') }"></textarea>
            </div>
            <div class="preview-panel">
              <div class="preview-toolbar"><span><i></i> 即時預覽</span><small>輸入程式碼後會立即更新</small></div>
              <iframe :srcdoc="previewDocument" title="程式碼即時預覽" sandbox="allow-scripts"></iframe>
            </div>
          </div>

          <!-- 驗證評估進行中卡片：與結果卡片在同一個區塊，僅顯示「檢查中請稍後......」 -->
          <transition name="fade">
            <div v-if="isAiVerifying" class="ai-evaluating-wrap" role="status" aria-live="polite">
              <MathCurveLoader
                size="md"
                label="檢查中請稍後......"
              />
            </div>
          </transition>

          <!-- 驗證答案結果：放置於 editor-layout 之下、challenge-actions 之上 -->
          <!-- 審核通過卡片（含學習評語與分數） -->
          <transition name="fade">
            <div v-if="aiResult?.passed" class="ai-success-card" role="alert">
              <div class="success-top">
                <span class="success-icon-svg">
                  <svg viewBox="0 0 24 24" width="22" height="22" stroke="#16a34a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </span>
                <div>
                  <h3 class="success-title">實作核對通過！得分：<span class="score-highlight">{{ aiResult.score }} / 100 分</span></h3>
                  <div class="success-summary markdown-content" v-html="renderMarkdown(aiResult.summary)"></div>
                </div>
              </div>
              <div v-if="aiResult.feedback" class="ai-feedback-box">
                <div class="ai-box-title">
                  <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="#2563eb" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  學習評語
                </div>
                <div class="ai-box-content markdown-content" v-html="renderMarkdown(aiResult.feedback)"></div>
              </div>
            </div>
          </transition>

          <!-- 審核未通過（含簡易修正提示與學習評語） -->
          <transition name="fade">
            <div v-if="aiResult && !aiResult.passed" class="ai-failure-card" role="alert">
              <div class="failure-top">
                <span class="failure-tag">
                  <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  尚未通過（目前得分：{{ aiResult.score }} 分）
                </span>
                <div class="failure-summary markdown-content" v-html="renderMarkdown(aiResult.summary)"></div>
              </div>

              <!-- 簡易修正提示 (Hints) -->
              <div v-if="aiResult.errors?.length" class="ai-hints-box">
                <div class="ai-box-title">
                  <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="#d97706" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  簡易修正提示
                </div>
                <div class="failure-error-list">
                  <div v-for="(err, idx) in aiResult.errors" :key="idx" class="failure-error-item">
                    <div class="failure-error-badge">
                      <span class="panel-name-tag">{{ err.panel.toUpperCase() }}</span>
                      <span v-if="err.line" class="line-tag">第 {{ err.line }} 行</span>
                      <span class="err-msg markdown-inline" v-html="renderInlineMarkdown(err.message)"></span>
                    </div>
                    <div v-if="err.suggestion" class="failure-suggestion-text markdown-content" v-html="renderMarkdown('💡 **思考引導：** ' + err.suggestion)"></div>
                  </div>
                </div>
              </div>

              <!-- 學習評語 (Feedback) -->
              <div v-if="aiResult.feedback" class="ai-feedback-box">
                <div class="ai-box-title">
                  <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="#2563eb" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  學習評語
                </div>
                <div class="ai-box-content markdown-content" v-html="renderMarkdown(aiResult.feedback)"></div>
              </div>
            </div>
          </transition>

          <div class="challenge-actions">
            <div class="challenge-actions-left">
              <!-- 驗證答案按鈕 -->
              <button
                class="ai-verify-btn"
                :disabled="isAiVerifying"
                type="button"
                @click="runAiVerification"
                title="驗證答案並進行評分"
              >
                <svg v-if="isAiVerifying" class="btn-svg btn-spin" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <svg v-else class="btn-svg" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>{{ isAiVerifying ? '驗證中...' : '驗證答案' }}</span>
              </button>

              <!-- 點擊 2 秒後顯示伺服器繁忙提示 -->
              <transition name="fade">
                <span v-if="isAiVerifying && showServerBusyHint" class="server-busy-hint" role="status">
                  <svg class="btn-spin" viewBox="0 0 24 24" width="13" height="13" stroke="#d97706" stroke-width="2.2" fill="none">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10"></path>
                  </svg>
                  伺服器繁忙中，請稍後......
                </span>
              </transition>

              <!-- 通過審核後自動標記完成狀態指示（非按鈕） -->
              <div v-if="isCurrentComplete" class="auto-completed-badge" role="status">
                <svg class="btn-svg" viewBox="0 0 24 24" width="16" height="16" stroke="#10b981" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>已通過驗證</span>
              </div>
            </div>

            <!-- 右側：作答統計與展開查詢詳細記錄按鈕 -->
            <div class="challenge-actions-right">
              <div class="submission-stats-group">
                <span class="stat-pill">
                  作答次數：<strong>{{ submissionCount }}</strong> 次
                </span>
                <span class="stat-pill">
                  最高分數：<strong :class="{ 'score-high': highestScore >= 60 }">{{ highestScore }}</strong> 分
                </span>
                <button
                  type="button"
                  class="history-expand-btn"
                  @click="showHistoryModal = true"
                  title="展開查詢本題歷次詳細作答記錄"
                >
                  <svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>展開詳細記錄</span>
                </button>
              </div>
            </div>
          </div>
          <transition name="fade">
            <div v-if="submissionMessage" class="submission-message" role="status" aria-live="polite">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>{{ submissionMessage }}</span>
            </div>
          </transition>
        </section>

          <div class="navigation">
            <button class="next-button" @click="goToNextLesson" :disabled="isLastLesson">
              <span>下一個主題</span>
              <svg class="btn-svg btn-svg-arrow" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </transition>
    </main>
    </div>

    <!-- 歷次詳細作答記錄 Modal -->
    <transition name="sys-modal" :duration="450">
      <div v-if="showHistoryModal" class="modal-overlay" @click.self="showHistoryModal = false">
        <div class="history-modal-card" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
          <div class="history-modal-header">
            <div>
              <h3 id="history-modal-title" class="history-modal-title">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#2563eb" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                作答歷史詳細記錄
              </h3>
              <p class="history-modal-subtitle">單元：{{ lesson.title }} · 共 {{ currentLessonSubmissions.length }} 筆作答記錄</p>
            </div>
            <button type="button" class="history-close-icon-btn" @click="showHistoryModal = false" aria-label="關閉視窗">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="history-modal-body-wrap" :style="historyMaskStyle">
            <div
              class="history-modal-body"
              ref="historyModalBodyRef"
              @scroll.passive="updateHistoryModalScroll"
            >
              <div v-if="isLoadingHistory" class="history-empty-state">
                <MathCurveLoader size="sm" label="正在讀取雲端歷次作答紀錄..." />
              </div>
              <div v-else-if="currentLessonSubmissions.length === 0" class="history-empty-state">
                <svg viewBox="0 0 24 24" width="38" height="38" stroke="#94a3b8" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>目前尚無本單元的作答記錄，完成編輯後點擊「驗證答案」即可在此查看歷史成績與評語！</p>
              </div>
              <div v-else class="history-timeline">
                <div
                  v-for="(item, index) in currentLessonSubmissions"
                  :key="item.id || index"
                  class="history-item-card"
                  :class="{ 'item-passed': item.completed || (item.score || 0) >= 60 }"
                >
                  <div class="history-item-header">
                    <div class="history-item-left">
                      <span class="history-index-tag">第 {{ currentLessonSubmissions.length - index }} 次作答</span>
                      <span class="history-time-tag">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        {{ item.submitted_at_tw || (item.created_at ? getTaiwanTimeString(new Date(item.created_at)) : '未知時間') }} (台灣時間)
                      </span>
                    </div>
                    <div class="history-item-right">
                      <span class="history-score-tag" :class="{ 'score-pass': item.score >= 60, 'score-fail': item.score < 60 }">
                        {{ item.score ?? 0 }} 分
                      </span>
                      <span class="history-status-badge" :class="{ 'status-pass': item.completed || (item.score || 0) >= 60, 'status-fail': !item.completed && (item.score || 0) < 60 }">
                        {{ item.completed || (item.score || 0) >= 60 ? '通過' : '未通過' }}
                      </span>
                    </div>
                  </div>
                  <div v-if="item.ai_feedback" class="history-feedback-content">
                    <strong>評語與提示：</strong>
                    <div class="markdown-content" v-html="renderMarkdown(item.ai_feedback)"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="history-modal-footer">
            <button type="button" class="history-modal-close-btn" @click="showHistoryModal = false">
              關閉
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
