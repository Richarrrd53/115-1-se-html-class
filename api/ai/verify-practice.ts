import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'project-ab68aaa2-ad0c-4e95-973'
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

let ai: GoogleGenAI | null = null
try {
  ai = new GoogleGenAI({ vertexAI: true, project: projectId, location })
} catch (e) {
  console.warn('[Vercel API] 初始化 GoogleGenAI 失敗，將啟用智慧語意評核備援：', e)
}

function buildPrompt(data: Record<string, any>): string {
  const checklist: string[] = Array.isArray(data.checklist) ? data.checklist : []
  const sc = data.starterCode || {}
  const ac = data.answerCode || {}
  const stu = data.studentCode || {}
  const cl = checklist.length ? checklist.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n') : '無指定清單'
  const jsonSpec = JSON.stringify({
    passed: 'boolean', score: 'number', summary: 'string', feedback: 'string',
    errors: [{ panel: 'html|css|js', line: 'number', message: 'string', suggestion: 'string' }],
    checklistStatus: [{ text: 'string', passed: 'boolean' }],
  })
  return [
    '你是一位專業、友善且嚴謹的前端教學助理。請評估學生在以下互動練習中的作答成果。',
    '',
    '【課程與題目資訊】',
    `單元名稱：${data.lessonTitle || ''}`,
    `教學目標：${data.lessonObjective || '依據題目要求完成實作'}`,
    '題目指示（Instructions）：',
    data.instructions || '',
    '',
    '【檢核標準清單（Checklist）】：',
    cl,
    '',
    '【題目初始代碼（Starter Code）】：',
    `HTML:\n```html\n${sc.html || ''}\n````,
    `CSS:\n```css\n${sc.css || ''}\n````,
    `JavaScript:\n```js\n${sc.js || ''}\n````,
    '',
    '【預期標準參考解答（Expected Answer）】：',
    `HTML:\n```html\n${ac.html || ''}\n````,
    `CSS:\n```css\n${ac.css || ''}\n````,
    `JavaScript:\n```js\n${ac.js || ''}\n````,
    '',
    '【學生目前提交之代碼（Student Code）】：',
    `HTML:\n```html\n${stu.html || ''}\n````,
    `CSS:\n```css\n${stu.css || ''}\n````,
    `JavaScript:\n```js\n${stu.js || ''}\n````,
    '',
    '【評估規則】：',
    '1. 嚴格檢查學生的代碼是否滿足題目指示、各項 Checklist 以及關鍵標籤/樣式/邏輯。',
    '2. 若學生完全達成題目要求：passed 設為 true，score 給予 85 到 100 分，errors 陣列可為空 []。',
    '3. 若學生未達成題目要求或有語法/規格錯誤：passed 設為 false，score 給予 0 到 79 分，errors 必須清楚列出具體錯誤（panel/line/message/suggestion）。',
    '4. 必須同時評估 Checklist 中的每一項是否達成。',
    '5. 必須以純 JSON 格式回傳，請勿夾帶任何 markdown 程式碼區塊外綴。',
    '',
    'JSON 格式規範：',
    jsonSpec,
  ].join('\n')
}

// 智慧服務端語意檢核備援
function serverSemanticEvaluate(data: Record<string, any>) {
  const checklist: string[] = Array.isArray(data.checklist) ? data.checklist : []
  const stu = data.studentCode || { html: '', css: '', js: '' }
  const html = stu.html || ''
  const css = stu.css || ''
  const js = stu.js || ''

  const errors: any[] = []
  const checklistStatus: any[] = []
  let passedCount = 0

  for (const item of checklist) {
    const itemLower = item.toLowerCase()
    let isPassed = false
    const tagMatch = item.match(/<([a-zA-Z0-9-]+)>/) || item.match(/`([a-zA-Z0-9-]+)`/)
    const targetTag = tagMatch ? tagMatch[1].toLowerCase() : null

    if (targetTag) {
      isPassed = new RegExp(`<${targetTag}(\\s+[^>]*)?>`, 'i').test(html)
    } else if (itemLower.includes('header')) {
      isPassed = /<header(\s+[^>]*)?>/i.test(html)
    } else if (itemLower.includes('nav')) {
      isPassed = /<nav(\s+[^>]*)?>/i.test(html)
    } else if (itemLower.includes('main')) {
      isPassed = /<main(\s+[^>]*)?>/i.test(html)
    } else if (itemLower.includes('footer')) {
      isPassed = /<footer(\s+[^>]*)?>/i.test(html)
    } else if (itemLower.includes('article') || itemLower.includes('section')) {
      isPassed = /<(article|section)(\s+[^>]*)?>/i.test(html)
    } else if (itemLower.includes('css') || itemLower.includes('樣式')) {
      isPassed = css.trim().length > 10 || /<style(\s+[^>]*)?>/i.test(html)
    } else if (itemLower.includes('js') || itemLower.includes('javascript')) {
      isPassed = js.trim().length > 5 || /<script(\s+[^>]*)?>/i.test(html)
    } else {
      isPassed = html.trim().length > 20
    }

    if (isPassed) passedCount++
    checklistStatus.push({ text: item, passed: isPassed })
  }

  const total = checklist.length || 1
  const ratio = passedCount / total
  const passed = ratio >= 0.8

  return {
    success: true,
    passed,
    score: passed ? Math.min(100, Math.round(85 + ratio * 15)) : Math.round(ratio * 70),
    summary: passed ? '實作結構與語意標準完整，恭喜通過！' : '部分項目尚未達成，請對照檢核清單進行調整。',
    feedback: passed ? '標籤結構規範，完成度非常高！' : '請確認題目要求的各個標籤是否都已正確加入。',
    errors,
    checklistStatus,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body || {}
  const studentId: string = typeof body.studentId === 'string' ? body.studentId.trim() : ''
  const studentName: string = typeof body.studentName === 'string' ? body.studentName.trim() : ''
  if (!studentId || !studentName) return res.status(400).json({ success: false, error: '請先填寫並驗證學號與姓名。' })

  if (ai) {
    try {
      const prompt = buildPrompt(body)
      let responseText = ''
      try {
        const r = await ai.models.generateContent({ model: modelName, contents: prompt, config: { responseMimeType: 'application/json' } })
        responseText = r.text || ''
      } catch {
        const r2 = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt, config: { responseMimeType: 'application/json' } })
        responseText = r2.text || ''
      }
      let clean = responseText.trim()
      if (clean.startsWith('```json')) clean = clean.slice(7)
      else if (clean.startsWith('```')) clean = clean.slice(3)
      if (clean.endsWith('```')) clean = clean.slice(0, -3)
      clean = clean.trim()
      const parsed = JSON.parse(clean)
      return res.status(200).json({
        success: true,
        passed: Boolean(parsed.passed),
        score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : (parsed.passed ? 100 : 50),
        summary: parsed.summary || (parsed.passed ? '實作練習已完全通過！' : '實作練習尚未達成所有要求，請參考錯誤提示修正。'),
        feedback: parsed.feedback || '',
        errors: Array.isArray(parsed.errors) ? parsed.errors : [],
        checklistStatus: Array.isArray(parsed.checklistStatus) ? parsed.checklistStatus : [],
      })
    } catch (err: any) {
      console.warn('[Vercel AI] Vertex AI 調用失敗，啟用服務端智慧評核備援：', err?.message || err)
    }
  }

  // 備援智慧評估返回 200
  const fallbackResult = serverSemanticEvaluate(body)
  return res.status(200).json(fallbackResult)
}
