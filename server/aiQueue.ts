import { GoogleGenAI } from '@google/genai'

// 載入 .env 設定
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile('.env')
  }
} catch {
  // .env 可能已被載入或在特定環境中不存在
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'project-ab68aaa2-ad0c-4e95-973'
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

const ai = new GoogleGenAI({
  vertexAI: true,
  project: projectId,
  location: location,
})

export interface VerificationRequest {
  lessonTitle: string
  lessonObjective?: string
  instructions: string
  starterCode?: { html?: string; css?: string; js?: string }
  answerCode?: { html?: string; css?: string; js?: string }
  checklist?: string[]
  studentCode: { html: string; css: string; js: string }
}

export interface VerificationErrorItem {
  panel: 'html' | 'css' | 'js'
  line?: number
  message: string
  suggestion?: string
}

export interface VerificationResponse {
  passed: boolean
  score: number
  summary: string
  feedback: string
  errors: VerificationErrorItem[]
  checklistStatus: Array<{ text: string; passed: boolean }>
  retries?: number
  isQueued?: boolean
}

// 請求佇列任務結構
interface QueueTask {
  request: VerificationRequest
  resolve: (res: VerificationResponse) => void
  reject: (err: any) => void
  retries: number
  enqueuedAt: number
}

class GeminiQueue {
  private queue: QueueTask[] = []
  private activeCount = 0
  private maxConcurrent = 1 // 嚴格序列化以避免 Vertex AI / Gemini 429
  private isThrottled = false

  public get queueLength(): number {
    return this.queue.length
  }

  public get isBusy(): boolean {
    return this.queue.length > 0 || this.activeCount > 0 || this.isThrottled
  }

  public enqueue(req: VerificationRequest): Promise<VerificationResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        request: req,
        resolve,
        reject,
        retries: 0,
        enqueuedAt: Date.now(),
      })
      this.processNext()
    })
  }

  private async processNext() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0 || this.isThrottled) {
      return
    }

    const task = this.queue.shift()
    if (!task) return

    this.activeCount++
    try {
      const result = await this.executeWithRetry(task)
      this.activeCount--
      task.resolve(result)
      this.processNext()
    } catch (error) {
      this.activeCount--
      task.reject(error)
      this.processNext()
    }
  }

  private async executeWithRetry(task: QueueTask): Promise<VerificationResponse> {
    const maxRetries = 3
    let attempt = 0

    while (attempt <= maxRetries) {
      try {
        const res = await callGeminiVerification(task.request)
        res.retries = attempt
        return res
      } catch (err: any) {
        const errorMsg = String(err?.message || err)
        const is429 =
          errorMsg.includes('429') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('quota') ||
          errorMsg.includes('Too Many Requests')

        attempt++
        if (is429 && attempt <= maxRetries) {
          this.isThrottled = true
          const delayMs = attempt * 3500 // 3.5s, 7s, 10.5s backoff
          console.warn(`[GeminiQueue] 觸發 429 速率限制，正在排隊休眠等待 ${delayMs}ms (第 ${attempt} 次重試)...`)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          this.isThrottled = false
        } else if (attempt <= maxRetries) {
          const delayMs = 2000
          console.warn(`[GeminiQueue] 發生臨時錯誤 (${errorMsg})，等待 ${delayMs}ms 重試...`)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        } else {
          throw err
        }
      }
    }
    throw new Error('超過最大重試次數，請稍候再試。')
  }
}

export const aiQueue = new GeminiQueue()

/**
 * 直接調用 Vertex AI Gemini 評估代碼
 */
async function callGeminiVerification(req: VerificationRequest): Promise<VerificationResponse> {
  const prompt = `你是一位專業、友善且嚴謹的軟體工程與前端教學助理。請評估學生在以下互動練習中的作答成果。

【課程與題目資訊】
單元名稱：${req.lessonTitle}
教學目標：${req.lessonObjective || '依據題目要求完成實作'}
題目指示（Instructions）：
${req.instructions}

【檢核標準清單（Checklist）】：
${(req.checklist || []).map((c, i) => `${i + 1}. ${c}`).join('\n') || '無指定清單，請根據題目指示全面檢查'}

【題目初始代碼（Starter Code）】：
HTML:
\`\`\`html
${req.starterCode?.html || ''}
\`\`\`
CSS:
\`\`\`css
${req.starterCode?.css || ''}
\`\`\`
JavaScript:
\`\`\`js
${req.starterCode?.js || ''}
\`\`\`

【預期標準參考解答（Expected Answer）】：
HTML:
\`\`\`html
${req.answerCode?.html || ''}
\`\`\`
CSS:
\`\`\`css
${req.answerCode?.css || ''}
\`\`\`
JavaScript:
\`\`\`js
${req.answerCode?.js || ''}
\`\`\`

【學生目前提交之代碼（Student Code）】：
HTML:
\`\`\`html
${req.studentCode.html || ''}
\`\`\`
CSS:
\`\`\`css
${req.studentCode.css || ''}
\`\`\`
JavaScript:
\`\`\`js
${req.studentCode.js || ''}
\`\`\`

【評估規則】：
1. 嚴格檢查學生的代碼是否滿足題目指示、各項 Checklist 以及關鍵標籤/樣式/邏輯。
2. 若學生完全達成題目要求（功能與畫面正確）：
   - passed 設為 true。
   - score 給予 85 到 100 分（依代碼整潔與規格精準度）。
   - errors 陣列可為空 []。
3. 若學生未達成題目要求或有語法/規格錯誤：
   - passed 設為 false。
   - score 給予 0 到 79 分。
   - errors 必須清楚列出具體錯誤：
     - panel: 錯誤發生的面板 ("html" | "css" | "js")
     - line: 該面板中的預估行號（整數，1 起算）
     - message: 錯誤原因（如 "找不到 class 為 card 的 div 元素" 或 "點擊事件未正確綁定"）
     - suggestion: 具體修改建議與提示（不可直接洩漏整段完整解答，引導其思考）。
4. 必須同時評估 Checklist 中的每一項是否達成。
5. 必須以純 JSON 格式回傳，請勿夾帶任何 markdown 程式碼區塊外綴。

JSON 格式規範：
{
  "passed": boolean,
  "score": number,
  "summary": string,
  "feedback": string,
  "errors": [
    {
      "panel": "html" | "css" | "js",
      "line": number,
      "message": string,
      "suggestion": string
    }
  ],
  "checklistStatus": [
    { "text": string, "passed": boolean }
  ]
}
`

  // 嘗試主要模型，若失敗可退回備援模型
  let responseText = ''
  try {
    const res = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    })
    responseText = res.text || ''
  } catch (primaryErr: any) {
    console.warn(`[Gemini] 主要模型 ${modelName} 呼叫失敗，嘗試備援模型 gemini-2.0-flash:`, primaryErr?.message)
    const fallbackRes = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    })
    responseText = fallbackRes.text || ''
  }

  // 清洗可能的 markdown 包裹
  let cleanJson = responseText.trim()
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.slice(7)
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.slice(3)
  }
  if (cleanJson.endsWith('```')) {
    cleanJson = cleanJson.slice(0, -3)
  }
  cleanJson = cleanJson.trim()

  const parsed = JSON.parse(cleanJson) as VerificationResponse

  // 補齊預設值防禦
  return {
    passed: Boolean(parsed.passed),
    score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : (parsed.passed ? 100 : 50),
    summary: parsed.summary || (parsed.passed ? '實作練習已完全通過！' : '實作練習尚未達成所有要求，請參考錯誤提示修正。'),
    feedback: parsed.feedback || '',
    errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    checklistStatus: Array.isArray(parsed.checklistStatus) ? parsed.checklistStatus : [],
  }
}
