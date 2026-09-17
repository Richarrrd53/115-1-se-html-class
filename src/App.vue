<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { lessons, stages, type Lesson } from './courseStore'
import { supabase } from './supabase'

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
const practiceStudents = ref<string[]>([])
const practiceSyncError = ref(false)
const submissionMessage = ref('')
const isSubmitting = ref(false)

const lesson = computed<Lesson>(() => lessons.value.find((item) => item.id === selectedLessonId.value) || lessons.value[0])
const practice = computed(() => lesson.value?.practice || { instructions: '', starterCode: { html: '', css: '', js: '' }, checklist: [], answer: { html: '', css: '', js: '' } })
const code = ref({ ...practice.value.starterCode })
const isCurrentComplete = computed(() => (lesson.value ? completedLessons.value[lesson.value.id] || false : false))
const completedCount = computed(() => Object.values(completedLessons.value).filter(Boolean).length)
const progress = computed(() => (lessons.value.length ? Math.round((completedCount.value / lessons.value.length) * 100) : 0))

watch(selectedLessonId, () => {
  showAnswer.value = false
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
  }
}

function toggleComplete() {
  if (lesson.value) {
    const completed = !isCurrentComplete.value
    completedLessons.value = { ...completedLessons.value, [lesson.value.id]: completed }
    syncPractice(completed)
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
      .order('created_at', { ascending: false })
    if (error) throw error
    practiceStudents.value = [...new Set((data ?? []).map((student) => student.student_name))]
    practiceSyncError.value = false
  } catch {
    practiceSyncError.value = true
  }
}

async function submitPractice() {
  submissionMessage.value = ''
  if (!studentId.value.trim() || !studentName.value.trim() || !lesson.value) {
    submissionMessage.value = '請輸入學號與姓名！'
    return
  }

  isSubmitting.value = true
  try {
    const { error } = await supabase.from('practice_submissions').insert({
      student_id: studentId.value.trim(),
      student_name: studentName.value.trim(),
      lesson_id: lesson.value.id,
      code: JSON.stringify(code.value),
    })
    if (error) throw error
    localStorage.setItem('webcraft-student-id', studentId.value.trim())
    localStorage.setItem('webcraft-student-name', studentName.value.trim())
    submissionMessage.value = '練習已成功送出！'
    await refreshPracticeStudents()
  } catch (error) {
    console.error('送出失敗：', error)
    submissionMessage.value = '送出失敗，請稍後再試。'
  } finally {
    isSubmitting.value = false
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
        <input v-model="studentId" placeholder="學號" maxlength="40" />
        <input v-model="studentName" placeholder="你的姓名" maxlength="80" />
        <span>{{ practiceStudents.length }} 位同學練習中</span>
        <small v-if="practiceSyncError" class="error">API 未連線</small>
      </div>
      <button class="ghost-button" @click="chooseLesson(lessons[0].id)">⌂ 回到總覽</button>
      <a :href="`${baseUrl}edit.html`" class="edit-nav-button" title="開啟獨立教材編輯頁面">✏️ 編輯教材</a>
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
            <span v-if="completedLessons[item.id]" class="done">✓</span>
          </button>
        </div>
      </aside>

      <main class="content">
        <div class="breadcrumb">課程地圖 <span>/</span> {{ stages.find((item) => item.id === lesson.stage)?.title }} <span>/</span> 單元 {{ lesson.number }}</div>
        <section class="lesson-heading">
          <div>
            <div class="eyebrow">CHAPTER {{ String(lesson.number).padStart(2, '0') }} · {{ lesson.type }}</div>
            <h1>{{ lesson.title }}</h1>
            <p>{{ lesson.objective }}</p>
          </div>
        </section>

        <section class="intro-card">
          <div class="intro-heading"><span class="section-kicker">快速認識</span><span class="intro-label">先掌握關鍵概念，再開始練習</span></div>
          <p>{{ lesson.introduction }}</p>
          <div class="concept-list">
            <div v-for="concept in lesson.concepts" :key="concept.name" class="concept-item">
              <code>{{ concept.name }}</code><span>{{ concept.description }}</span>
            </div>
          </div>
        </section>

        <section class="example-card">
          <div class="section-heading"><div><span class="section-kicker">先看範例</span><h2>{{ lesson.example.title }}</h2></div><span class="chip">可執行範例</span></div>
          <p>{{ lesson.example.description }}</p>
          <div class="example-code"><pre><code>{{ lesson.example.code }}</code></pre><div class="example-preview" v-html="lesson.example.preview"></div></div>
        </section>

        <section class="challenge-card">
          <div class="challenge-intro">
            <div><span class="section-kicker">實作練習</span><h2>動手做做看</h2><p>{{ practice.instructions }}</p></div>
            <button class="reset-button" @click="resetCode">↻ 重設程式碼</button>
          </div>
          <div class="editor-layout">
            <div class="editor-panel">
              <div class="tabs">
                <button :class="{ active: activePanel === 'html' }" @click="activePanel = 'html'"><i class="html-dot"></i> HTML</button>
                <button :class="{ active: activePanel === 'css' }" @click="activePanel = 'css'"><i class="css-dot"></i> CSS</button>
                <button :class="{ active: activePanel === 'js' }" @click="activePanel = 'js'"><i class="js-dot"></i> JavaScript</button>
              </div>
              <textarea v-if="activePanel === 'html'" v-model="code.html" spellcheck="false" aria-label="HTML 編輯器"></textarea>
              <textarea v-else-if="activePanel === 'css'" v-model="code.css" spellcheck="false" aria-label="CSS 編輯器"></textarea>
              <textarea v-else v-model="code.js" spellcheck="false" aria-label="JavaScript 編輯器"></textarea>
            </div>
            <div class="preview-panel">
              <div class="preview-toolbar"><span><i></i> 即時預覽</span><small>輸入程式碼後會立即更新</small></div>
              <iframe :srcdoc="previewDocument" title="程式碼即時預覽" sandbox="allow-scripts"></iframe>
            </div>
          </div>
          <div class="checklist">
            <div class="checklist-title">自我檢查 <span>完成後勾選，不會自動批改</span></div>
            <label v-for="item in practice.checklist" :key="item"><input type="checkbox" :checked="isCurrentComplete" @change="toggleComplete"><span>{{ item }}</span></label>
          </div>
          <div class="challenge-actions">
            <button class="answer-button" @click="showAnswer = !showAnswer">{{ showAnswer ? '隱藏參考答案' : '查看參考答案' }} <span>⌄</span></button>
            <button class="complete-button" :class="{ completed: isCurrentComplete }" @click="toggleComplete">{{ isCurrentComplete ? '已完成 ✓' : '標記為完成' }}</button>
            <button class="complete-button" :disabled="isSubmitting" @click="submitPractice">{{ isSubmitting ? '送出中...' : '送出練習' }}</button>
          </div>
          <p v-if="submissionMessage" class="submission-message">{{ submissionMessage }}</p>
          <div v-if="showAnswer" class="answer-box">
            <strong>參考答案</strong>
            <div v-for="panel in [{ name: 'HTML', code: practice.answer.html }, { name: 'CSS', code: practice.answer.css }, { name: 'JavaScript', code: practice.answer.js }]" :key="panel.name" class="answer-section">
              <div v-if="panel.code" class="answer-language">{{ panel.name }}</div>
              <pre v-if="panel.code">{{ panel.code }}</pre>
            </div>
          </div>
        </section>

        <div class="navigation">
          <span></span>
          <button class="next-button" @click="goToNextLesson" :disabled="isLastLesson">下一個主題 <span>→</span></button>
        </div>
      </main>
    </div>
  </div>
</template>
