import { ref } from 'vue'
import {
  defaultStages,
  defaultLessons,
  type Stage,
  type Lesson,
  type Code,
  type Concept,
} from './lessons'

export type { Stage, Lesson, Code, Concept }

const STORAGE_KEY = 'webcraft_custom_courses_v1'

interface StoredData {
  stages: Stage[]
  lessons: Lesson[]
}

function loadInitialData(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.stages) && Array.isArray(parsed.lessons) && parsed.lessons.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('無法從 localStorage 讀取課程資料，改用預設資料', err)
  }
  return {
    stages: JSON.parse(JSON.stringify(defaultStages)),
    lessons: JSON.parse(JSON.stringify(defaultLessons)),
  }
}

const initial = loadInitialData()
export const stages = ref<Stage[]>(initial.stages)
export const lessons = ref<Lesson[]>(initial.lessons)

export function saveCourseData() {
  const data: StoredData = {
    stages: stages.value,
    lessons: lessons.value,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('儲存至 localStorage 失敗', err)
  }

  // 廣播給同頁面監聽者與跨視窗 / iframe
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('webcraft-data-changed', { detail: data }))
    window.postMessage({ type: 'WEBCRAFT_COURSES_UPDATED', data }, '*')
  }
}

// 監聽來自其他視窗（例如 edit.html -> index.html iframe）的 postMessage
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'WEBCRAFT_COURSES_UPDATED' && event.data.data) {
      const { stages: newStages, lessons: newLessons } = event.data.data
      if (Array.isArray(newStages) && Array.isArray(newLessons)) {
        stages.value = newStages
        lessons.value = newLessons
      }
    }
  })

  // 監聽其他分頁的 localStorage 變更
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue)
        if (Array.isArray(parsed.stages) && Array.isArray(parsed.lessons)) {
          stages.value = parsed.stages
          lessons.value = parsed.lessons
        }
      } catch (e) {
        console.error('解析 storage 變更失敗', e)
      }
    }
  })
}

// ======================= Stage 操作 =======================
export function addStage(title = '新學習階段'): Stage {
  const maxId = stages.value.reduce((max, s) => Math.max(max, s.id), 0)
  const newStage: Stage = {
    id: maxId + 1,
    title,
  }
  stages.value.push(newStage)
  saveCourseData()
  return newStage
}

export function updateStage(id: number, title: string) {
  const target = stages.value.find((s) => s.id === id)
  if (target) {
    target.title = title
    saveCourseData()
  }
}

export function deleteStage(id: number): boolean {
  // 檢查是否有單元依賴此階段
  const hasLessons = lessons.value.some((l) => l.stage === id)
  if (hasLessons) {
    return false
  }
  stages.value = stages.value.filter((s) => s.id !== id)
  saveCourseData()
  return true
}

// ======================= Lesson 操作 =======================
export function createEmptyLesson(stageId: number): Lesson {
  const maxNum = lessons.value.reduce((max, l) => Math.max(max, l.number), 0)
  const newNum = maxNum + 1
  const stageObj = stages.value.find((s) => s.id === stageId) || stages.value[0]
  const currentStageId = stageObj ? stageObj.id : 1

  return {
    id: `${currentStageId}-${newNum}`,
    number: newNum,
    stage: currentStageId,
    type: currentStageId === 1 ? 'HTML' : currentStageId <= 4 ? 'CSS' : 'JavaScript',
    title: `單元 ${newNum} 標題`,
    objective: '請在此輸入本單元的學習目標與核心重點。',
    introduction: '請在此輸入本單元的概念引言介紹，幫助學習者在實作前快速理解背景知識。',
    concepts: [
      { name: '標籤或語法名稱', description: '用途與注意事項說明。' },
    ],
    example: {
      title: '基礎範例',
      description: '先觀察完整範例的結構，再到下方編輯器動手修改。',
      code: '<div class="box">\n  <p>這是一個範例</p>\n</div>',
      preview: '<div style="padding: 16px; background: #eef0ff; border-radius: 8px;">這是一個範例</div>',
    },
    practice: {
      instructions: '請根據題目指示完成實作練習。',
      starterCode: {
        html: '<div class="practice">\n  <!-- 請在此開始撰寫 -->\n</div>',
        css: '.practice {\n  padding: 12px;\n}',
        js: '// 撰寫 JavaScript\n',
      },
      checklist: [
        '我已經完成了基礎骨架',
        '內容格式符合預期',
      ],
      answer: {
        html: '<div class="practice">\n  <h1>完成成果</h1>\n</div>',
        css: '.practice {\n  padding: 12px;\n  color: #3149d8;\n}',
        js: '// 參考程式碼\n',
      },
    },
  }
}

export function addLesson(lesson: Lesson) {
  lessons.value.push(lesson)
  saveCourseData()
}

export function updateLesson(id: string, updated: Partial<Lesson>) {
  const index = lessons.value.findIndex((l) => l.id === id)
  if (index !== -1) {
    lessons.value[index] = {
      ...lessons.value[index],
      ...updated,
    }
    saveCourseData()
  }
}

export function deleteLesson(id: string) {
  lessons.value = lessons.value.filter((l) => l.id !== id)
  saveCourseData()
}

// ======================= 系統維護與匯出 =======================
export function resetToDefault() {
  stages.value = JSON.parse(JSON.stringify(defaultStages))
  lessons.value = JSON.parse(JSON.stringify(defaultLessons))
  saveCourseData()
}

export function exportJson(): string {
  const data: StoredData = {
    stages: stages.value,
    lessons: lessons.value,
  }
  return JSON.stringify(data, null, 2)
}

export function importJson(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString)
    if (Array.isArray(data.stages) && Array.isArray(data.lessons) && data.lessons.length > 0) {
      stages.value = data.stages
      lessons.value = data.lessons
      saveCourseData()
      return true
    }
  } catch (err) {
    console.error('匯入 JSON 失敗:', err)
  }
  return false
}

export function generateLessonsTsCode(): string {
  const stageEntries = stages.value.map(s => `  { id: ${s.id}, title: ${JSON.stringify(s.title)} },`).join('\n')

  const introEntries = lessons.value.map(l => {
    return `  ${l.number}: { text: ${JSON.stringify(l.introduction)}, concepts: ${JSON.stringify(l.concepts)} },`
  }).join('\n')

  const instructionEntries = lessons.value.map(l => {
    return `  ${l.number}: ${JSON.stringify(l.practice.instructions)},`
  }).join('\n')

  const starterEntries = lessons.value.map(l => {
    return `  ${l.number}: code(${JSON.stringify(l.practice.starterCode.html)}, ${JSON.stringify(l.practice.starterCode.css)}, ${JSON.stringify(l.practice.starterCode.js)}),`
  }).join('\n')

  const answerEntries = lessons.value.map(l => {
    return `  ${l.number}: code(${JSON.stringify(l.practice.answer.html)}, ${JSON.stringify(l.practice.answer.css)}, ${JSON.stringify(l.practice.answer.js)}),`
  }).join('\n')

  const topicEntries = lessons.value.map(l => {
    return `  [${l.stage}, ${l.number}, ${JSON.stringify(l.title)}, ${JSON.stringify(l.objective)}, ${JSON.stringify(l.example.title)}, code(${JSON.stringify(l.example.code)}, ${JSON.stringify(l.example.preview)}), ${JSON.stringify(l.practice.instructions)}, ${JSON.stringify(l.practice.checklist)}, ${JSON.stringify(l.practice.answer.html)}],`
  }).join('\n')

  return `export type Code = { html: string; css: string; js: string }
export type Concept = { name: string; description: string }
export type Stage = { id: number; title: string }
export type Lesson = {
  id: string; number: number; stage: number; type: string; title: string; objective: string
  introduction: string; concepts: Concept[]
  example: { title: string; description: string; code: string; preview: string }
  practice: { instructions: string; starterCode: Code; checklist: string[]; answer: Code }
}

export const stages: Stage[] = [
${stageEntries}
]

const code = (html: string, css = '', js = ''): Code => ({ html, css, js })

const introductions: Record<number, { text: string; concepts: Concept[] }> = {
${introEntries}
}

const formatCode = (value: string, type: keyof Code) => {
  const normalized = value.replace(/\\\\n/g, '\\n').trim()
  if (type === 'html') {
    const lines = normalized
      .replace(/></g, '>\\n<')
      .replace(/^\\s+|\\s+$/g, '')
      .split('\\n')
    let depth = 0
    const voidTags = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\\b/i
    return lines.map((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('</')) depth = Math.max(0, depth - 1)
      const formatted = \`\${'  '.repeat(depth)}\${trimmed}\`
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<!') &&
        !trimmed.includes('</') && !trimmed.endsWith('/>') && !voidTags.test(trimmed.slice(1))) depth += 1
      return formatted
    }).join('\\n')
  }
  if (type === 'css') {
    return normalized
      .replace(/\\{/g, ' {\\n  ')
      .replace(/;/g, ';\\n  ')
      .replace(/\\}/g, '\\n}\\n')
      .replace(/\\n\\s*\\n/g, '\\n')
      .replace(/  \\n/g, '\\n')
      .trim()
  }
  return normalized
    .replace(/\\{/g, ' {\\n  ')
    .replace(/;/g, ';\\n  ')
    .replace(/\\}/g, '\\n}\\n')
    .replace(/\\n\\s*\\n/g, '\\n')
    .replace(/  \\n/g, '\\n')
    .trim()
}

const formatCodeSet = (value: Code): Code => ({
  html: formatCode(value.html, 'html'),
  css: formatCode(value.css, 'css'),
  js: formatCode(value.js, 'js'),
})

const challengeInstructions: Record<number, string> = {
${instructionEntries}
}

const challengeStarters: Record<number, Code> = {
${starterEntries}
}

const challengeAnswers: Record<number, Code> = {
${answerEntries}
}

const topics: [number, number, string, string, string, Code, string, string[], string][] = [
${topicEntries}
]

export const lessons: Lesson[] = topics.map((topic) => {
  const [stage, number, title, objective, exampleTitle, starterCode] = topic
  const checklist = topic[7]
  const formatted = formatCodeSet(starterCode)
  return {
    id: \`\${stage}-\${number}\`, number, stage, type: stage === 1 ? 'HTML' : stage <= 4 ? 'CSS' : 'JavaScript', title, objective,
    introduction: introductions[number]?.text || '', concepts: introductions[number]?.concepts || [],
    example: { title: exampleTitle, description: '先觀察完整範例的結構，再到下方編輯器動手修改。', code: formatted.html, preview: formatted.html },
    practice: {
      instructions: challengeInstructions[number] || '',
      starterCode: formatCodeSet(challengeStarters[number] || code('')),
      checklist: checklist || [],
      answer: formatCodeSet(challengeAnswers[number] || code('')),
    },
  }
})

export const defaultStages = stages
export const defaultLessons = lessons
`
}
