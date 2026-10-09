<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { verifySqlPracticeWithAI, type AiVerificationResult } from '../aiService'
import { sqlLessons as units, syncSqlCourseDataFromDatabase } from '../sqlCourseStore'

const props = defineProps<{ studentId: string; studentName: string; practiceStudents: string[] }>()
const emit = defineEmits<{ requestProfile: [] }>()
const activeUnitId = ref(units.value[0].id)
const activeUnit = computed(() => units.value.find((unit) => unit.id === activeUnitId.value) || units.value[0])
const sqlDraft = ref(activeUnit.value.starter)
const isChecking = ref(false)
const result = ref<AiVerificationResult | null>(null)
const errorMessage = ref('')
const savedSqlProgress = (() => {
  try {
    return {
      completed: JSON.parse(localStorage.getItem('sql-completed-levels') || '{}') as Record<string, boolean>,
      scores: JSON.parse(localStorage.getItem('sql-completed-scores') || '{}') as Record<string, number>,
    }
  } catch {
    return { completed: {}, scores: {} }
  }
})()
const sqlCompleted = ref<Record<string, boolean>>(savedSqlProgress.completed)
const sqlScores = ref<Record<string, number>>(savedSqlProgress.scores)
const exerciseCount = computed(() => units.value.filter((unit) => unit.hasExercise !== false).length)
const completedExerciseCount = computed(() =>
  units.value.filter((unit) => unit.hasExercise !== false && sqlCompleted.value[unit.id]).length,
)

onMounted(() => {
  void syncSqlCourseDataFromDatabase()
})

watch(activeUnit, (unit) => {
  sqlDraft.value = unit.starter
  result.value = null
  errorMessage.value = ''
})

async function checkAnswer() {
  if (!sqlDraft.value.trim() || sqlDraft.value.trim() === activeUnit.value.starter.trim()) {
    errorMessage.value = '先依照題目修改 SQL，再請 AI 檢查喔。'
    result.value = null
    return
  }
  if (!props.studentId.trim() || !props.studentName.trim()) {
    errorMessage.value = '請先在左下角完成課程身分驗證，再使用 AI 檢查。'
    return
  }
  isChecking.value = true
  errorMessage.value = ''
  result.value = null
  try {
    result.value = await verifySqlPracticeWithAI({
      studentId: props.studentId,
      studentName: props.studentName,
      lessonId: 'sql-' + activeUnit.value.id,
      lessonTitle: activeUnit.value.title,
      lessonObjective: activeUnit.value.objective,
      instructions: activeUnit.value.question,
      checklist: activeUnit.value.checklist,
      starterCode: { html: activeUnit.value.starter, css: '', js: '' },
      answerCode: { html: activeUnit.value.answer, css: '', js: '' },
      studentCode: { html: sqlDraft.value, css: '', js: '' },
    })
    const unitId = activeUnit.value.id
    sqlCompleted.value = { ...sqlCompleted.value, [unitId]: true }
    sqlScores.value = {
      ...sqlScores.value,
      [unitId]: Math.max(sqlScores.value[unitId] ?? -1, result.value.score),
    }
    localStorage.setItem('sql-completed-levels', JSON.stringify(sqlCompleted.value))
    localStorage.setItem('sql-completed-scores', JSON.stringify(sqlScores.value))
  } catch {
    errorMessage.value = '目前無法完成 AI 檢查，請稍後再試。'
  } finally {
    isChecking.value = false
  }
}
</script>

<template>
  <div class="workspace sql-workspace">
    <aside class="sidebar sql-sidebar">
      <div class="side-header">
        <div class="side-logo brand-logo">
          <div class="side-logo-badge">SQL</div>
          <div class="logo-text">複習<span>單元</span></div>
        </div>
        <span class="side-progress-badge" title="已完成 SQL 練習">{{ completedExerciseCount }}/{{ exerciseCount }}</span>
      </div>
      <nav class="side-body" aria-label="SQL 複習單元">
        <button
          v-for="(unit, index) in units"
          :key="unit.id"
          type="button"
          class="side-link sub-link lesson-link sql-unit-link"
          :class="{ active: activeUnitId === unit.id }"
          :disabled="isChecking"
          @click="activeUnitId = unit.id"
        >
          <span class="link-glow" aria-hidden="true"></span>
          <span class="lesson-number">{{ index + 1 }}</span>
          <span class="lesson-title-text sub-text">{{ unit.title }}</span>
          <span
            v-if="unit.hasExercise !== false && sqlCompleted[unit.id]"
            class="done"
            :class="{ 'done-warning': (sqlScores[unit.id] ?? 0) < 60 }"
            :title="(sqlScores[unit.id] ?? 0) < 60 ? '已完成練習（目前最高 ' + sqlScores[unit.id] + ' 分）' : '已通過練習（目前最高 ' + sqlScores[unit.id] + ' 分）'"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        </button>
      </nav>
      <div class="side-footer">
        <div
          class="top-avatar"
          @click="emit('requestProfile')"
          :title="'目前身分：' + (studentName || '未驗證') + (studentId ? ' (' + studentId + ')' : '') + ' - 點擊變更'"
        >
          {{ studentName ? studentName.trim().charAt(0) : '學' }}
        </div>
        <div
          class="side-footer-info"
          @click="emit('requestProfile')"
          style="cursor: pointer;"
          :title="'目前身分：' + (studentName || '未驗證') + (studentId ? ' (' + studentId + ')' : '') + ' - 點擊變更'"
        >
          <span class="side-footer-name">{{ studentName ? studentName + (studentId ? ' (' + studentId + ')' : '') : '點此驗證身分' }}</span>
          <span class="side-footer-sub">
            <span class="presence-dot-mini"></span>
            {{ practiceStudents.length }} 位同學在線
          </span>
        </div>
      </div>
    </aside>

    <main class="content sql-content">
      <div class="breadcrumb">SQL 複習 <span>/</span> 單元 {{ units.findIndex((unit) => unit.id === activeUnitId) + 1 }}</div>
      <section class="lesson-heading sql-lesson-heading">
        <div>
          <div class="eyebrow">CHAPTER {{ String(units.findIndex((unit) => unit.id === activeUnitId) + 1).padStart(2, '0') }} · POSTGRESQL</div>
          <h1>{{ activeUnit.title }}</h1>
          <p class="sql-unit-concept">{{ activeUnit.concept }}</p>
          <p class="lesson-objective">{{ activeUnit.objective }}</p>
        </div>
      </section>

      <section v-if="activeUnit.hasExercise === false" class="sql-overview-grid" aria-label="SQL 基礎觀念">
        <article v-for="point in activeUnit.reviewPoints" :key="point.title" class="sql-overview-card">
          <h2>{{ point.title }}</h2>
          <p>{{ point.body }}</p>
          <pre><code>{{ point.example }}</code></pre>
        </article>
      </section>

      <section v-if="activeUnit.hasExercise !== false" class="example-card sql-example-card">
        <div class="section-heading"><div><span class="section-kicker">情境資料</span><h2>{{ activeUnit.tableName }}</h2></div><span class="chip">模擬資料</span></div>
        <div class="sql-simulated-table-wrap">
          <table class="sql-simulated-table">
            <thead><tr><th v-for="column in activeUnit.columns" :key="column">{{ column }}</th></tr></thead>
            <tbody><tr v-for="(row, rowIndex) in activeUnit.rows" :key="rowIndex"><td v-for="(value, colIndex) in row" :key="colIndex">{{ value }}</td></tr></tbody>
          </table>
        </div>
        <p class="sql-simulation-note">這是題目用的示意資料，不會執行 SQL 或連接資料庫。</p>
      </section>

      <section v-if="activeUnit.hasExercise !== false" class="challenge-card sql-challenge-card">
        <div class="challenge-intro">
          <div><span class="section-kicker">實作練習</span><h2>動手寫查詢</h2><p class="challenge-instructions">{{ activeUnit.question }}</p></div>
          <button class="reset-button" type="button" @click="sqlDraft = activeUnit.starter; result = null; errorMessage = ''">重設程式碼</button>
        </div>
        <div class="sql-editor-wrap">
          <div class="sql-editor-toolbar"><span><i></i> query.sql</span><small>PostgreSQL</small></div>
          <textarea v-model="sqlDraft" class="sql-editor" spellcheck="false" aria-label="SQL 查詢編輯器" :disabled="isChecking"></textarea>
        </div>
        <details class="sql-reference-answer">
          <summary>查看參考答案</summary>
          <pre><code>{{ activeUnit.answer }}</code></pre>
        </details>
        <p v-if="errorMessage" class="sql-check-error" role="alert">{{ errorMessage }}</p>
        <div v-if="isChecking" class="sql-check-status" role="status">AI 正在閱讀你的 SQL，請稍候…</div>
        <section v-if="result" class="sql-ai-result" :class="{ passed: result.passed }" aria-live="polite">
          <div class="sql-ai-result-heading"><strong>{{ result.passed ? '檢查通過' : '再調整看看' }}</strong><span>{{ result.score }} / 100</span></div>
          <p>{{ result.summary }}</p>
          <p v-if="result.feedback">{{ result.feedback }}</p>
          <ul v-if="result.checklistStatus.length">
            <li v-for="item in result.checklistStatus" :key="item.text" :class="{ complete: item.passed }">
              {{ item.passed ? '✓' : '○' }} {{ item.text }}
            </li>
          </ul>
        </section>
        <div class="challenge-actions">
          <button class="ai-verify-btn" type="button" :disabled="isChecking" @click="checkAnswer">
            {{ isChecking ? 'AI 檢查中…' : 'AI 檢查答案' }}
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
