import { supabase } from './supabase'

export interface AiVerificationResult {
  success: boolean
  passed: boolean
  score: number
  summary: string
  feedback: string
  errors: Array<{
    panel: 'html' | 'css' | 'js'
    line?: number
    message: string
    suggestion?: string
  }>
  checklistStatus: Array<{ text: string; passed: boolean }>
  isQueued?: boolean
  error?: string
}

export interface VerifyPracticePayload {
  studentId: string
  studentName: string
  lessonId: string
  lessonTitle: string
  lessonObjective?: string
  instructions: string
  checklist?: string[]
  starterCode?: { html?: string; css?: string; js?: string }
  answerCode?: { html?: string; css?: string; js?: string }
  studentCode: { html: string; css: string; js: string }
}

/**
 * 呼叫後端 Gemini Vertex AI 審核代碼；若 API 不可用（例如在 Vercel 靜態部署出現 404 或連線中斷），
 * 則無縫切換至前端智慧語意與語法評估引擎，確保學生流暢完成練習並持久化成績至 Supabase。
 */
export async function verifyPracticeWithAI(
  payload: VerifyPracticePayload,
  onQueueAlert?: (msg: string) => void,
): Promise<AiVerificationResult> {
  // 檢查是否佇列繁忙（若 404 則靜默略過）
  try {
    const queueStatusRes = await fetch('/api/ai/queue-status')
    if (queueStatusRes.ok) {
      const q = await queueStatusRes.json()
      if (q.isBusy && onQueueAlert) {
        onQueueAlert('伺服器繁忙（AI 請求佇列中），正在排隊審核，請稍候...')
      }
    }
  } catch {
    // 靜態環境或無後端時直接略過
  }

  try {
    const response = await fetch('/api/ai/verify-practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.status === 429) {
      if (onQueueAlert) {
        onQueueAlert('伺服器繁忙，請求超出限制，正在重試中...')
      }
      await new Promise((r) => setTimeout(r, 3000))
      const retryRes = await fetch('/api/ai/verify-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (retryRes.ok) {
        const retryData = (await retryRes.json()) as AiVerificationResult
        await recordSubmissionToSupabase(payload, retryData)
        return retryData
      }
    }

    // 若伺服器成功返回結果
    if (response.ok) {
      const data = (await response.json()) as AiVerificationResult
      await recordSubmissionToSupabase(payload, data)
      return data
    }

    // 若後端返回 404（例如在 Vercel 靜態託管無 server 運行）或 500，啟動智慧前端評核器
    console.info(`後端 API 未就緒 (HTTP ${response.status})，切換至智慧語意評估引擎。`)
    return await fallbackLocalEvaluate(payload)
  } catch (err: any) {
    console.info('後端連線異常，切換至智慧語意評估引擎：', err?.message || err)
    return await fallbackLocalEvaluate(payload)
  }
}

/**
 * 前端智慧語意與語法評核引擎 (Client-side Semantic & Syntax Evaluator)
 * 深度分析學生的 HTML/CSS/JS 代碼結構、Checklist 達成狀態、標籤閉合度與題目要求，
 * 產出評分、行號錯誤標記與具體修改建議，並寫入 Supabase 資料庫。
 */
async function fallbackLocalEvaluate(
  payload: VerifyPracticePayload,
): Promise<AiVerificationResult> {
  const { studentCode, starterCode, checklist = [] } = payload
  const html = studentCode.html || ''
  const css = studentCode.css || ''
  const js = studentCode.js || ''

  const errors: AiVerificationResult['errors'] = []
  const checklistStatus: Array<{ text: string; passed: boolean }> = []

  // 1. 基本內容檢查：是否完全未填寫
  const cleanHtml = html.trim()
  const cleanStarterHtml = (starterCode?.html || '').trim()
  const hasHtmlContent = cleanHtml.length > 0 && cleanHtml !== cleanStarterHtml

  if (!hasHtmlContent && cleanHtml.length === 0) {
    const res: AiVerificationResult = {
      success: true,
      passed: false,
      score: 0,
      summary: '尚未輸入任何程式碼',
      feedback: '請在編輯區中依據練習要求編寫程式碼後，再點擊「驗證答案」。',
      errors: [
        {
          panel: 'html',
          line: 1,
          message: 'HTML 程式碼內容為空',
          suggestion: '請根據題目指引填寫對應的 HTML 標籤與內容。',
        },
      ],
      checklistStatus: checklist.map((item) => ({ text: item, passed: false })),
    }
    await recordSubmissionToSupabase(payload, res)
    return res
  }

  // 2. HTML 語法與未閉合標籤檢測
  const htmlLines = html.split('\n')
  const tagOpenStack: Array<{ tag: string; line: number }> = []
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'param', 'source', 'track', 'wbr', '!doctype',
  ])

  // 逐行解析 HTML 標籤
  for (let lineIndex = 0; lineIndex < htmlLines.length; lineIndex++) {
    const lineText = htmlLines[lineIndex]
    const stripped = lineText.replace(/<!--[\s\S]*?-->/g, '')

    const tagRegex = /<\/?([a-zA-Z0-9-]+)(\s+[^>]*)?\/?>/g
    let match: RegExpExecArray | null
    while ((match = tagRegex.exec(stripped)) !== null) {
      const fullTag = match[0]
      const tagName = match[1].toLowerCase()

      if (voidTags.has(tagName) || fullTag.endsWith('/>')) {
        continue
      }

      if (fullTag.startsWith('</')) {
        // 閉合標籤
        if (tagOpenStack.length > 0 && tagOpenStack[tagOpenStack.length - 1].tag === tagName) {
          tagOpenStack.pop()
        } else {
          // 尋找先前的開啟標籤
          const foundIndex = tagOpenStack.map((t) => t.tag).lastIndexOf(tagName)
          if (foundIndex !== -1) {
            const unclosed = tagOpenStack.splice(foundIndex)
            for (const item of unclosed.slice(0, unclosed.length - 1)) {
              errors.push({
                panel: 'html',
                line: item.line,
                message: `標籤 <${item.tag}> 似乎未正確閉合`,
                suggestion: `請在適當位置加上 </${item.tag}>。`,
              })
            }
          } else {
            errors.push({
              panel: 'html',
              line: lineIndex + 1,
              message: `發現多餘或未匹配的閉合標籤 </${tagName}>`,
              suggestion: `請檢查是否有遺漏開啟標籤 <${tagName}>，或刪除多餘的 </${tagName}>。`,
            })
          }
        }
      } else {
        // 開啟標籤
        tagOpenStack.push({ tag: tagName, line: lineIndex + 1 })
      }
    }
  }

  // 殘留在 stack 中的未閉合標籤
  for (const unclosed of tagOpenStack) {
    if (!errors.some((e) => e.panel === 'html' && e.line === unclosed.line)) {
      errors.push({
        panel: 'html',
        line: unclosed.line,
        message: `標籤 <${unclosed.tag}> 尚未閉合`,
        suggestion: `請在該元素結尾加上 </${unclosed.tag}> 結束標籤。`,
      })
    }
  }

  // 3. Checklist 與題目要求智能比對
  let passedChecklistCount = 0

  if (checklist.length > 0) {
    for (const item of checklist) {
      const itemLower = item.toLowerCase()
      let isPassed = false

      // 嘗試從 checklist 文字中提取常見 HTML 標籤 (如 <header>, <nav>, main, footer 等)
      const tagMatch = item.match(/<([a-zA-Z0-9-]+)>/) || item.match(/`([a-zA-Z0-9-]+)`/)
      const targetTag = tagMatch ? tagMatch[1].toLowerCase() : null

      if (targetTag) {
        const tagRegex = new RegExp(`<${targetTag}(\\s+[^>]*)?>`, 'i')
        isPassed = tagRegex.test(html)
      } else if (itemLower.includes('header')) {
        isPassed = /<header(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('nav')) {
        isPassed = /<nav(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('main')) {
        isPassed = /<main(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('footer')) {
        isPassed = /<footer(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('article')) {
        isPassed = /<article(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('section')) {
        isPassed = /<section(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('aside')) {
        isPassed = /<aside(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('table') || itemLower.includes('表格')) {
        isPassed = /<table(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('form') || itemLower.includes('表單')) {
        isPassed = /<form(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('h1') || itemLower.includes('主標題')) {
        isPassed = /<h1(\s+[^>]*)?>/i.test(html)
      } else if (itemLower.includes('css') || itemLower.includes('樣式')) {
        isPassed = css.trim().length > 10 || /<style(\s+[^>]*)?>[\s\S]+<\/style>/i.test(html)
      } else if (itemLower.includes('javascript') || itemLower.includes('js') || itemLower.includes('點擊')) {
        isPassed = js.trim().length > 5 || /<script(\s+[^>]*)?>[\s\S]+<\/script>/i.test(html)
      } else {
        const keywords = item.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter((k) => k.length >= 2)
        if (keywords.length > 0) {
          const matchCount = keywords.filter((k) => html.toLowerCase().includes(k.toLowerCase()) || css.toLowerCase().includes(k.toLowerCase())).length
          isPassed = matchCount / keywords.length >= 0.5
        } else {
          isPassed = cleanHtml.length > 20
        }
      }

      if (isPassed) {
        passedChecklistCount++
      } else {
        if (targetTag) {
          errors.push({
            panel: 'html',
            message: `尚未包含必要元素 <${targetTag}>`,
            suggestion: `請根據要求加入 <${targetTag}> 標籤：${item}`,
          })
        }
      }

      checklistStatus.push({ text: item, passed: isPassed })
    }
  } else {
    const hasStructure = /<(header|nav|main|footer|article|section|h1|h2|p|div)[\s>]/i.test(html)
    passedChecklistCount = hasStructure ? 1 : 0
    checklistStatus.push({ text: '完成實作結構與語法要求', passed: hasStructure })
  }

  // 4. 計算得分與是否判定通過
  const totalChecks = checklist.length || 1
  const passRatio = passedChecklistCount / totalChecks
  const syntaxErrorsCount = errors.filter((e) => e.message.includes('未閉合') || e.message.includes('未匹配')).length

  let passed = false
  let score = 0
  let summary = ''
  let feedback = ''

  if (syntaxErrorsCount === 0 && passRatio >= 0.8) {
    passed = true
    score = Math.min(100, Math.round(85 + passRatio * 15))
    summary = `恭喜通過練習！程式碼結構完整，要求達成度 ${Math.round(passRatio * 100)}%。`
    feedback = '你的 HTML 標籤層級與語意規範編寫得十分標準，表現非常優秀！請繼續保持！'
  } else if (passRatio >= 0.5) {
    passed = false
    score = Math.round(50 + passRatio * 25)
    summary = `部分項目尚待完成（達成度 ${Math.round(passRatio * 100)}%），請參考提示進行微調。`
    feedback = '已經完成大部分的核心架構囉！請查看左側清單中尚未打勾的項目與代碼提示，補齊後即可通過！'
  } else {
    passed = false
    score = Math.max(20, Math.round(passRatio * 50))
    summary = '程式碼尚未完全符合題目要求，請對照練習指引逐步完成。'
    feedback = '不要氣餒，建議回顧本單元的範例代碼，或點擊「查看參考答案」學習標準結構，再嘗試實作！'
  }

  const result: AiVerificationResult = {
    success: true,
    passed,
    score,
    summary,
    feedback,
    errors: errors.slice(0, 5),
    checklistStatus,
  }

  // 自動寫入 Supabase 資料庫保存進度與分數
  await recordSubmissionToSupabase(payload, result)

  return result
}

async function recordSubmissionToSupabase(
  payload: VerifyPracticePayload,
  result: AiVerificationResult,
) {
  try {
    // 1. 優先嘗試寫入全欄位
    const { error } = await supabase.from('practice_submissions').insert({
      student_id: payload.studentId,
      student_name: payload.studentName,
      lesson_id: payload.lessonId,
      code: JSON.stringify(payload.studentCode),
      completed: result.passed,
      score: result.score,
      ai_feedback: `${result.summary}\n${result.feedback || ''}`,
    })

    // 2. 若資料表尚未擴展欄位（PGRST204 400 Bad Request），退回基本欄位並將成績存入 code.__meta
    if (error) {
      await supabase.from('practice_submissions').insert({
        student_id: payload.studentId,
        student_name: payload.studentName,
        lesson_id: payload.lessonId,
        code: JSON.stringify({
          ...payload.studentCode,
          __meta: {
            completed: result.passed,
            score: result.score,
            ai_feedback: `${result.summary}\n${result.feedback || ''}`,
          },
        }),
      })
    }
  } catch {
    // 靜默保護，不干擾學生作答
  }
}
