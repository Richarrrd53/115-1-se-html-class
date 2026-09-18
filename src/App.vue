<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { lessons, stages, type Lesson } from './courseStore'
import { supabase } from './supabase'
import { renderMarkdown, renderInlineMarkdown } from './markdown'
import { verifyCourseMember } from './memberService'
import { verifyPracticeWithAI, type AiVerificationResult } from './aiService'


const baseUrl = import.meta.env.BASE_URL
const selectedLessonId = ref(localStorage.getItem('selected-lesson') || (lessons.value[0]?.id || '1-1'))
const showAnswer = ref(false)
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
const aiQueueMessage = ref('')
const aiResult = ref<AiVerificationResult | null>(null)
const initialSubmissionCounts: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem('lesson-submission-counts') || '{}')
  } catch {
    return {}
  }
})()
const lessonSubmissionCounts = ref<Record<string, number>>(initialSubmissionCounts)
watch(
  lessonSubmissionCounts,
  (val) => localStorage.setItem('lesson-submission-counts', JSON.stringify(val)),
  { deep: true },
)

const lesson = computed<Lesson>(() => lessons.value.find((item) => item.id === selectedLessonId.value) || lessons.value[0])
const practice = computed(() => lesson.value?.practice || { instructions: '', starterCode: { html: '', css: '', js: '' }, checklist: [], answer: { html: '', css: '', js: '' } })
const code = ref({ ...practice.value.starterCode })
const isCurrentComplete = computed(() => (lesson.value ? completedLessons.value[lesson.value.id] || false : false))
const hasSubmittedAtLeastOnce = computed(() => {
  const lessonId = lesson.value?.id || ''
  return (lessonSubmissionCounts.value[lessonId] || 0) > 0 || Boolean(isCurrentComplete.value)
})
const completedCount = computed(() => Object.values(completedLessons.value).filter(Boolean).length)
const progress = computed(() => (lessons.value.length ? Math.round((completedCount.value / lessons.value.length) * 100) : 0))

watch(selectedLessonId, () => {
  showAnswer.value = false
  aiResult.value = null
  aiQueueMessage.value = ''
  if (lesson.value?.practice) {
    code.value = { ...lesson.value.practice.starterCode }
  }
  localStorage.setItem('selected-lesson', selectedLessonId.value)
  refreshPracticeStudents()
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

function chooseLesson(id: string) {
  selectedLessonId.value = id
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

const activePanelErrors = computed(() => {
  return aiResult.value?.errors.filter((e) => e.panel === activePanel.value) || []
})

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

    lessonSubmissionCounts.value[lesson.value.id] =
      (lessonSubmissionCounts.value[lesson.value.id] || 0) + 1

    aiResult.value = result

    if (result.passed) {
      completedLessons.value = { ...completedLessons.value, [lesson.value.id]: true }
      syncPractice(true)
      aiQueueMessage.value = ''
    }
  } catch (error: any) {
    lessonSubmissionCounts.value[lesson.value.id] =
      (lessonSubmissionCounts.value[lesson.value.id] || 0) + 1
    console.error('驗證失敗：', error)
  } finally {
    isAiVerifying.value = false
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
  } catch (error) {
    console.error('驗證身分出錯：', error)
    studentProfileError.value = '身分驗證發生異常，請稍後再試！'
  } finally {
    isVerifyingProfile.value = false
  }
}

function toggleComplete() {
  if (lesson.value) {
    const completed = !isCurrentComplete.value
    completedLessons.value = { ...completedLessons.value, [lesson.value.id]: completed }
    syncPractice(completed)
    submissionMessage.value = completed
      ? '已成功標記為完成！'
      : '已取消完成標記。'
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
    if (error) throw error
    practiceSyncError.value = false
    await refreshPracticeStudents()
  } catch {
    practiceSyncError.value = true
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

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const queryLesson = urlParams.get('lesson')
  if (queryLesson && lessons.value.some((item) => item.id === queryLesson)) {
    selectedLessonId.value = queryLesson
  }
  window.addEventListener('message', handleWindowMessage)
  refreshPracticeStudents()
})

onUnmounted(() => {
  window.removeEventListener('message', handleWindowMessage)
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

    <div v-if="showStudentProfileModal" class="modal-overlay student-profile-overlay">
      <form class="modal-box student-profile-modal" @submit.prevent="confirmStudentProfile">
        <div class="modal-header">
          <div>
            <span class="section-kicker">身分驗證</span>
            <h3>請先驗證你的課程身分</h3>
          </div>
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
            placeholder="例如：113213081"
            :disabled="isVerifyingProfile"
          />
          <label for="student-name">姓名</label>
          <input
            id="student-name"
            v-model="studentName"
            required
            maxlength="80"
            autocomplete="name"
            placeholder="例如：何彥緻"
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
      <div class="practice-presence">
        <button
          type="button"
          class="student-identity-badge"
          @click="showStudentProfileModal = true"
          :title="'目前身分：' + (studentName || '未驗證') + ' (' + (studentId || '點擊驗證') + ') - 點擊可變更'"
        >
          <svg class="badge-icon-svg" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
            <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
          </svg>
          <span class="badge-text">{{ studentName ? `${studentName} (${studentId})` : '點此驗證身分' }}</span>
        </button>
        <span>{{ practiceStudents.length }} 位同學練習中</span>
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
      <aside class="sidebar">
        <div class="sidebar-title">課程地圖 <span>{{ completedCount }}/{{ lessons.length }}</span></div>
        <div v-for="stage in stages" :key="stage.id" class="stage-group">
          <div class="stage-label"><span class="stage-dot" :class="`stage-${stage.id}`"></span>{{ stage.title }}</div>
          <button
            v-for="item in lessons.filter((entry) => entry.stage === stage.id)"
            :key="item.id"
            class="lesson-link"
            :class="{ active: item.id === lesson.id }"
            @click="chooseLesson(item.id)"
          >
            <span class="lesson-number">{{ item.number }}</span>
            <span>{{ item.title }}</span>
            <span v-if="completedLessons[item.id]" class="done">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </button>
        </div>
      </aside>

      <main class="content">
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

          <!-- 審核通過卡片 -->
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
                  <p class="success-summary">{{ aiResult.summary }}</p>
                </div>
              </div>
              <p v-if="aiResult.feedback" class="success-feedback">學習回饋：{{ aiResult.feedback }}</p>
            </div>
          </transition>

          <!-- 審核未通過（紅色標註卡片） -->
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
                <p class="failure-summary">{{ aiResult.summary }}</p>
              </div>
              <div v-if="aiResult.errors?.length" class="failure-error-list">
                <div v-for="(err, idx) in aiResult.errors" :key="idx" class="failure-error-item">
                  <div class="failure-error-badge">
                    <svg class="btn-svg" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    {{ err.panel.toUpperCase() }} 待修正<span v-if="err.line">（第 {{ err.line }} 行）</span>
                  </div>
                  <div class="failure-error-text">{{ err.message }}</div>
                  <div v-if="err.suggestion" class="failure-suggestion-text">建議修正：{{ err.suggestion }}</div>
                </div>
              </div>
              <p v-if="aiResult.feedback" class="failure-feedback-text">{{ aiResult.feedback }}</p>
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

              <!-- 當前面板紅色行內錯誤提醒卡 -->
              <div v-if="activePanelErrors.length > 0" class="panel-errors-callout">
                <div v-for="(err, idx) in activePanelErrors" :key="idx" class="callout-error-row">
                  <svg class="callout-error-svg" viewBox="0 0 24 24" width="13" height="13" stroke="#ef4444" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <div class="callout-error-content">
                    <strong v-if="err.line">第 {{ err.line }} 行：</strong>
                    <span>{{ err.message }}</span>
                    <div v-if="err.suggestion" class="callout-hint">提示：{{ err.suggestion }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="preview-panel">
              <div class="preview-toolbar"><span><i></i> 即時預覽</span><small>輸入程式碼後會立即更新</small></div>
              <iframe :srcdoc="previewDocument" title="程式碼即時預覽" sandbox="allow-scripts"></iframe>
            </div>
          </div>
          <div class="challenge-actions">
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

            <!-- 至少送出 1 次後才出現：查看參考答案、標記為完成 -->
            <template v-if="hasSubmittedAtLeastOnce">
              <button
                class="answer-button"
                type="button"
                @click="showAnswer = !showAnswer"
              >
                <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path v-if="!showAnswer" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle v-if="!showAnswer" cx="12" cy="12" r="3"></circle>
                  <path v-if="showAnswer" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line v-if="showAnswer" x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
                <span>{{ showAnswer ? '隱藏參考答案' : '查看參考答案' }}</span>
              </button>
              <button
                class="complete-button"
                :class="{ completed: isCurrentComplete }"
                type="button"
                @click="toggleComplete"
              >
                <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>{{ isCurrentComplete ? '已標記完成' : '標記為完成' }}</span>
              </button>
            </template>
          </div>
          <p v-if="submissionMessage" class="submission-message" role="status" aria-live="polite">{{ submissionMessage }}</p>
          <div v-if="showAnswer" class="answer-box">
            <strong>參考答案</strong>
            <div v-for="panel in [{ name: 'HTML', code: practice.answer.html }, { name: 'CSS', code: practice.answer.css }, { name: 'JavaScript', code: practice.answer.js }]" :key="panel.name" class="answer-section">
              <div v-if="panel.code" class="answer-language">{{ panel.name }}</div>
              <pre v-if="panel.code">{{ panel.code }}</pre>
            </div>
          </div>
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
      </main>
    </div>
  </div>
</template>
