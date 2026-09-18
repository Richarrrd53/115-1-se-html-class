import { ref } from 'vue'
import { supabase } from './supabase'
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
        return {
          stages: parsed.stages,
          lessons: parsed.lessons.map(decodeLesson),
        }
      }
    }
  } catch (err) {
    console.warn('無法從 localStorage 讀取課程資料，改用預設資料', err)
  }
  return {
    stages: JSON.parse(JSON.stringify(defaultStages)),
    lessons: (JSON.parse(JSON.stringify(defaultLessons)) as Lesson[]).map(decodeLesson),
  }
}

const initial = loadInitialData()
export const stages = ref<Stage[]>(initial.stages)
export const lessons = ref<Lesson[]>(initial.lessons)
export const isSyncingCourseData = ref(false)
export const isLoadedFromDb = ref(false)
export const lastSyncTime = ref<string | null>(null)

function broadcastCourseData() {
  if (typeof window === 'undefined') return
  try {
    const data: StoredData = {
      stages: JSON.parse(JSON.stringify(stages.value)),
      lessons: JSON.parse(JSON.stringify(lessons.value)),
    }
    window.dispatchEvent(new CustomEvent('webcraft-data-changed', { detail: data }))
    window.postMessage({ type: 'WEBCRAFT_COURSES_UPDATED', data }, '*')
  } catch (err) {
    console.warn('廣播課程資料失敗:', err)
  }
}

export interface CourseStageRow {
  id: number
  title: string
  created_at?: string
  updated_at?: string
}

export interface CourseLessonRow {
  id: string
  lesson_number: number
  stage_id: number
  lesson_type: string
  title: string
  objective: string
  introduction: string
  concepts: Concept[]
  example_title: string
  example_description: string
  example_code: string
  example_preview: string
  practice_instructions: string
  practice_starter_html: string
  practice_starter_css: string
  practice_starter_js: string
  practice_checklist: string[]
  practice_answer_html: string
  practice_answer_css: string
  practice_answer_js: string
  created_at?: string
  updated_at?: string
}

/**
 * 讀取時解碼：將字面上的 \\n, \\r\\n, \\t 等轉義符號轉換為真實的換行與縮排功能
 */
export function decodeFormatText(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return ''
  return val
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
}

/**
 * 寫入時正規化：統一各作業系統換行 (\r\n -> \n)，若有未轉換的字面 \\n 亦一併轉為真實換行
 */
export function encodeFormatText(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return ''
  return val
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
}

export function decodeLesson(l: Lesson): Lesson {
  return {
    id: l.id,
    number: l.number,
    stage: l.stage,
    type: l.type,
    title: decodeFormatText(l.title),
    objective: decodeFormatText(l.objective),
    introduction: decodeFormatText(l.introduction),
    concepts: (l.concepts || []).map((c) => ({
      name: decodeFormatText(c.name),
      description: decodeFormatText(c.description),
    })),
    example: {
      title: decodeFormatText(l.example?.title),
      description: decodeFormatText(l.example?.description),
      code: decodeFormatText(l.example?.code),
      preview: decodeFormatText(l.example?.preview),
    },
    practice: {
      instructions: decodeFormatText(l.practice?.instructions),
      starterCode: {
        html: decodeFormatText(l.practice?.starterCode?.html),
        css: decodeFormatText(l.practice?.starterCode?.css),
        js: decodeFormatText(l.practice?.starterCode?.js),
      },
      checklist: (l.practice?.checklist || []).map((item) => decodeFormatText(item)),
      answer: {
        html: decodeFormatText(l.practice?.answer?.html),
        css: decodeFormatText(l.practice?.answer?.css),
        js: decodeFormatText(l.practice?.answer?.js),
      },
    },
  }
}

export function encodeLesson(l: Lesson): Lesson {
  return {
    id: l.id,
    number: l.number,
    stage: l.stage,
    type: l.type,
    title: encodeFormatText(l.title),
    objective: encodeFormatText(l.objective),
    introduction: encodeFormatText(l.introduction),
    concepts: (l.concepts || []).map((c) => ({
      name: encodeFormatText(c.name),
      description: encodeFormatText(c.description),
    })),
    example: {
      title: encodeFormatText(l.example?.title),
      description: encodeFormatText(l.example?.description),
      code: encodeFormatText(l.example?.code),
      preview: encodeFormatText(l.example?.preview),
    },
    practice: {
      instructions: encodeFormatText(l.practice?.instructions),
      starterCode: {
        html: encodeFormatText(l.practice?.starterCode?.html),
        css: encodeFormatText(l.practice?.starterCode?.css),
        js: encodeFormatText(l.practice?.starterCode?.js),
      },
      checklist: (l.practice?.checklist || []).map((item) => encodeFormatText(item)),
      answer: {
        html: encodeFormatText(l.practice?.answer?.html),
        css: encodeFormatText(l.practice?.answer?.css),
        js: encodeFormatText(l.practice?.answer?.js),
      },
    },
  }
}

export function lessonToRow(l: Lesson): CourseLessonRow {
  const enc = encodeLesson(l)
  return {
    id: enc.id,
    lesson_number: enc.number,
    stage_id: enc.stage,
    lesson_type: enc.type,
    title: enc.title,
    objective: enc.objective,
    introduction: enc.introduction,
    concepts: enc.concepts || [],
    example_title: enc.example?.title || '',
    example_description: enc.example?.description || '',
    example_code: enc.example?.code || '',
    example_preview: enc.example?.preview || '',
    practice_instructions: enc.practice?.instructions || '',
    practice_starter_html: enc.practice?.starterCode?.html || '',
    practice_starter_css: enc.practice?.starterCode?.css || '',
    practice_starter_js: enc.practice?.starterCode?.js || '',
    practice_checklist: enc.practice?.checklist || [],
    practice_answer_html: enc.practice?.answer?.html || '',
    practice_answer_css: enc.practice?.answer?.css || '',
    practice_answer_js: enc.practice?.answer?.js || '',
    updated_at: new Date().toISOString(),
  }
}

export function rowToLesson(r: CourseLessonRow): Lesson {
  const raw: Lesson = {
    id: r.id,
    number: r.lesson_number,
    stage: r.stage_id,
    type: r.lesson_type,
    title: r.title,
    objective: r.objective,
    introduction: r.introduction,
    concepts: Array.isArray(r.concepts) ? r.concepts : [],
    example: {
      title: r.example_title || '',
      description: r.example_description || '',
      code: r.example_code || '',
      preview: r.example_preview || '',
    },
    practice: {
      instructions: r.practice_instructions || '',
      starterCode: {
        html: r.practice_starter_html || '',
        css: r.practice_starter_css || '',
        js: r.practice_starter_js || '',
      },
      checklist: Array.isArray(r.practice_checklist) ? r.practice_checklist : [],
      answer: {
        html: r.practice_answer_html || '',
        css: r.practice_answer_css || '',
        js: r.practice_answer_js || '',
      },
    },
  }
  return decodeLesson(raw)
}

/**
 * 從 Supabase 雲端資料庫讀取最新教材內容
 * 優先讀取正規化資料表 (course_stages 與 course_lessons)，徹底拆分各個元素
 */
export async function syncCourseDataFromDatabase(): Promise<boolean> {
  isSyncingCourseData.value = true
  try {
    // 1. 優先從正規化關聯資料表讀取 (course_stages + course_lessons)
    try {
      const { data: stagesData, error: stagesErr } = await supabase
        .from('course_stages')
        .select('*')
        .order('id', { ascending: true })

      const { data: lessonsData, error: lessonsErr } = await supabase
        .from('course_lessons')
        .select('*')
        .order('stage_id', { ascending: true })
        .order('lesson_number', { ascending: true })

      if (!stagesErr && !lessonsErr && stagesData && lessonsData && stagesData.length > 0 && lessonsData.length > 0) {
        stages.value = stagesData.map((s: CourseStageRow) => ({ id: s.id, title: s.title }))
        lessons.value = lessonsData.map((r: CourseLessonRow) => rowToLesson(r))
        lastSyncTime.value = new Date().toISOString()
        isLoadedFromDb.value = true
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ stages: stages.value, lessons: lessons.value }))
        broadcastCourseData()
        return true
      }
    } catch {
      // 正規化表格尚未建立時靜默嘗試備援
    }

    // 2. 備援讀取：course_content
    try {
      const { data, error } = await supabase
        .from('course_content')
        .select('stages, lessons, updated_at')
        .eq('id', 'current')
        .maybeSingle()

      if (!error && data?.lessons && Array.isArray(data.lessons) && data.lessons.length > 0) {
        stages.value = data.stages || defaultStages
        lessons.value = data.lessons.map(decodeLesson)
        lastSyncTime.value = data.updated_at || new Date().toISOString()
        isLoadedFromDb.value = true
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ stages: stages.value, lessons: lessons.value }))
        broadcastCourseData()
        return true
      }
    } catch {}

    // 3. 備援讀取：practice_submissions 歷史備份 (__SYSTEM_COURSE_DATA__)
    try {
      const { data: subData, error: subError } = await supabase
        .from('practice_submissions')
        .select('code, created_at')
        .eq('student_id', '__SYSTEM_COURSE_DATA__')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!subError && subData?.code) {
        const parsed = JSON.parse(subData.code)
        if (Array.isArray(parsed.lessons) && parsed.lessons.length > 0) {
          stages.value = parsed.stages || defaultStages
          lessons.value = parsed.lessons.map(decodeLesson)
          lastSyncTime.value = subData.created_at || new Date().toISOString()
          isLoadedFromDb.value = true
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ stages: stages.value, lessons: lessons.value }))
          broadcastCourseData()
          return true
        }
      }
    } catch {}
  } catch (err) {
    void err
  } finally {
    isSyncingCourseData.value = false
  }
  return false
}

/**
 * 將目前教材內容各個元素拆分直接寫入 Supabase 正規化資料表 (course_stages 與 course_lessons)
 */
export async function saveCourseDataToDatabase(): Promise<{ success: boolean; message: string }> {
  // 先將記憶體中的課程文字統一正規化換行格式
  lessons.value = lessons.value.map(encodeLesson)
  saveCourseData()
  isSyncingCourseData.value = true

  try {
    let savedNormalized = false

    // 1. 拆分各個元素寫入正規化資料表 (course_stages + course_lessons)
    try {
      const stageRows = stages.value.map((s) => ({
        id: s.id,
        title: encodeFormatText(s.title),
        updated_at: new Date().toISOString(),
      }))
      const lessonRows = lessons.value.map((l) => lessonToRow(l))

      const { error: stageErr } = await supabase.from('course_stages').upsert(stageRows)
      const { error: lessonErr } = await supabase.from('course_lessons').upsert(lessonRows)

      if (!stageErr && !lessonErr) {
        savedNormalized = true
      }
    } catch {}

    // 2. 同步儲存至相容備援表 (course_content 與 practice_submissions)
    try {
      await supabase.from('course_content').upsert({
        id: 'current',
        stages: stages.value,
        lessons: lessons.value,
        updated_at: new Date().toISOString(),
      })
    } catch {}

    try {
      await supabase.from('practice_submissions').insert({
        student_id: '__SYSTEM_COURSE_DATA__',
        student_name: 'COURSE_DATA',
        lesson_id: 'current',
        code: JSON.stringify({ stages: stages.value, lessons: lessons.value }),
      })
    } catch {}

    lastSyncTime.value = new Date().toISOString()
    isLoadedFromDb.value = true

    return {
      success: true,
      message: savedNormalized
        ? '教材個別元素已成功拆分寫入雲端關聯式資料庫（course_stages / course_lessons）！'
        : '教材內容已成功寫入雲端資料庫！',
    }
  } catch (err: any) {
    console.error('寫入教材至資料庫失敗：', err)
    return { success: false, message: `寫入資料庫失敗：${err?.message || '未知錯誤'}` }
  } finally {
    isSyncingCourseData.value = false
  }
}

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

  broadcastCourseData()
}

// 頁面載入時自動在背景嘗試從資料庫同步最新教材，切換視窗時自動重新檢查
if (typeof window !== 'undefined') {
  syncCourseDataFromDatabase()

  let lastFocusSync = 0
  window.addEventListener('focus', () => {
    const now = Date.now()
    if (now - lastFocusSync > 15000) {
      lastFocusSync = now
      syncCourseDataFromDatabase()
    }
  })
}

// 監聽來自其他視窗（例如 edit.html -> index.html iframe）的 postMessage
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.source === window) return
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
  saveCourseDataToDatabase()
  return newStage
}

export function updateStage(id: number, title: string) {
  const target = stages.value.find((s) => s.id === id)
  if (target) {
    target.title = title
    saveCourseDataToDatabase()
  }
}

export function deleteStage(id: number): boolean {
  // 檢查是否有單元依賴此階段
  const hasLessons = lessons.value.some((l) => l.stage === id)
  if (hasLessons) {
    return false
  }
  stages.value = stages.value.filter((s) => s.id !== id)
  try {
    Promise.resolve(supabase.from('course_stages').delete().eq('id', id)).catch(() => {})
  } catch {}
  saveCourseDataToDatabase()
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
  saveCourseDataToDatabase()
}

export function updateLesson(id: string, updated: Partial<Lesson>) {
  const index = lessons.value.findIndex((l) => l.id === id)
  if (index !== -1) {
    lessons.value[index] = {
      ...lessons.value[index],
      ...updated,
    }
    saveCourseDataToDatabase()
  }
}

export function deleteLesson(id: string) {
  lessons.value = lessons.value.filter((l) => l.id !== id)
  try {
    Promise.resolve(supabase.from('course_lessons').delete().eq('id', id)).catch(() => {})
  } catch {}
  saveCourseDataToDatabase()
}

// ======================= 系統維護與匯出 =======================
export function resetToDefault() {
  stages.value = JSON.parse(JSON.stringify(defaultStages))
  lessons.value = JSON.parse(JSON.stringify(defaultLessons))
  saveCourseDataToDatabase()
}

export function importLessonsTs(tsCode: string): { success: boolean; message: string } {
  try {
    const stageIndex = tsCode.search(/(export\s+)?const\s+stages/i)
    let cleaned = stageIndex !== -1 ? tsCode.slice(stageIndex) : tsCode

    cleaned = cleaned.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
    cleaned = cleaned.replace(/\bexport\s+/g, '')
    cleaned = cleaned.replace(/(const\s+[a-zA-Z0-9_]+)\s*:[^=]+=/g, '$1 =')
    cleaned = cleaned.replace(/\(html:\s*string,\s*css\s*=\s*['"][^'"]*['"],\s*js\s*=\s*['"][^'"]*['"]\):\s*Code\s*=>/g, '(html, css = "", js = "") =>')
    cleaned = cleaned.replace(/\(value:\s*string,\s*type:\s*keyof\s*Code\)/g, '(value, type)')
    cleaned = cleaned.replace(/\(value:\s*Code\):\s*Code\s*=>/g, '(value) =>')

    const runner = new Function(`
      ${cleaned}
      let finalStages = typeof stages !== 'undefined' ? stages : (typeof defaultStages !== 'undefined' ? defaultStages : []);
      let finalLessons = typeof lessons !== 'undefined' ? lessons : (typeof defaultLessons !== 'undefined' ? defaultLessons : []);
      return { stages: finalStages, lessons: finalLessons };
    `)

    const result = runner()
    if (Array.isArray(result.stages) && Array.isArray(result.lessons) && result.lessons.length > 0) {
      stages.value = result.stages
      lessons.value = result.lessons
      saveCourseDataToDatabase()
      return {
        success: true,
        message: `成功匯入並同步至雲端資料庫！共讀取到 ${result.stages.length} 個階段與 ${result.lessons.length} 個單元。`,
      }
    } else {
      return { success: false, message: '解析失敗：未能從上傳的 .ts 檔案中讀取到合法的 stages 或 lessons 陣列。' }
    }
  } catch (err: any) {
    console.error('匯入 TS 失敗:', err)
    return { success: false, message: `解析 TS 檔案時發生語法錯誤：${err?.message || err}` }
  }
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
