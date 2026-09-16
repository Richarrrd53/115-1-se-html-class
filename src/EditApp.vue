<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  exportJson,
  importJson,
  generateLessonsTsCode,
  saveCourseData,
} from './courseStore'


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

// 深度監聽目前編輯的內容，自動觸發儲存與 iframe 同步
watch(
  [stages, lessons],
  () => {
    saveCourseData()
    syncToIframe()
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
    previewIframe.value.src = `/index.html?lesson=${selectedLessonId.value}&t=${Date.now()}`
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

function handleExportJson() {
  const jsonStr = exportJson()
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `webcraft-lessons-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleImportJson(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (text) {
      if (importJson(text)) {
        alert('匯入成功！已套用新教材設定。')
        if (lessons.value.length > 0) {
          selectedLessonId.value = lessons.value[0].id
        }
      } else {
        alert('匯入失敗，請確認 JSON 檔案格式是否正確。')
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
    <!-- 頂部工具導航列 -->
    <header class="editor-header">
      <div class="editor-brand">
        <div class="brand-mark">&lt;/&gt;</div>
        <div>
          <strong>WebCraft 教材編輯器</strong>
          <span>視覺化管理與即時雙向預覽</span>
        </div>
      </div>

      <div class="editor-header-actions">
        <button class="btn btn-outline" @click="showStageModal = true">
          🗂️ 階段管理 ({{ stages.length }})
        </button>
        <button class="btn btn-primary" @click="handleAddLesson">
          ➕ 新增單元
        </button>

        <div class="divider"></div>

        <button class="btn btn-secondary" @click="openExportModal">
          💾 匯出 lessons.ts
        </button>
        <button class="btn btn-outline" @click="handleExportJson">
          📤 匯出 JSON
        </button>
        <label class="btn btn-outline file-label">
          📥 匯入 JSON
          <input type="file" accept=".json" style="display: none" @change="handleImportJson" />
        </label>
        <button class="btn btn-danger-outline" @click="handleResetDefault">
          ↺ 還原預設
        </button>

        <a href="/" target="_blank" class="btn btn-link">
          👀 開啟學習頁面 ↗
        </a>
      </div>
    </header>

    <!-- 主工作區：雙欄分割 -->
    <div class="editor-split-body">
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
              <label>學習目標 (objective)</label>
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
              <label>觀念引言 (introduction)</label>
              <textarea
                v-model="currentLesson.introduction"
                rows="3"
                placeholder="輸入單元觀念介紹引言..."
                class="input-control"
              ></textarea>
            </div>

            <div class="concepts-section">
              <div class="sub-header">
                <label>關鍵概念卡片 (concepts: name / description)</label>
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
                <label>範例說明 (example.description)</label>
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
              <label>實作任務指示 (challengeInstructions / practice.instructions)</label>
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
                <label>自我檢查清單 (checklist)</label>
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
            :src="`/index.html?lesson=${selectedLessonId}`"
            class="live-preview-frame"
            @load="onIframeLoad"
          ></iframe>
        </div>
      </section>
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
