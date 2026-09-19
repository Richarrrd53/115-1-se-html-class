import { GoogleGenAI } from '@google/genai'
import fs from 'node:fs'
import path from 'node:path'

// 載入 .env 設定
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile('.env')
  }
} catch {
  // .env 可能已被載入或在特定環境中不存在
}

function getGcpKeyPath(): string {
  if (process.platform === 'win32') {
    const dir = path.join(process.cwd(), 'node_modules', '.tmp')
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch {}
    return path.join(dir, 'gcp-key.json')
  }
  return '/tmp/gcp-key.json'
}

function ensureGcpCredentials() {
  if (process.env.GCP_SERVICE_ACCOUNT_BASE64) {
    try {
      const credentialsJson = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
      const keyPath = getGcpKeyPath()
      fs.writeFileSync(keyPath, credentialsJson)
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath
      console.log('[AI Queue] 已解碼 GCP_SERVICE_ACCOUNT_BASE64 並寫入', keyPath)
    } catch (err: any) {
      console.error('[AI Queue] 解析 GCP_SERVICE_ACCOUNT_BASE64 失敗：', err?.message || err)
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim()
    if (cred.startsWith('{')) {
      try {
        const keyPath = getGcpKeyPath()
        fs.writeFileSync(keyPath, cred)
        process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath
        console.log('[AI Queue] 偵測到 GOOGLE_APPLICATION_CREDENTIALS 為 JSON 字串，已自動寫入', keyPath)
      } catch (err: any) {
        console.error('[AI Queue] 寫入憑證失敗：', err?.message || err)
      }
    }
  }
}

ensureGcpCredentials()

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'project-ab68aaa2-ad0c-4e95-973'
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

const ai = new GoogleGenAI({
  vertexai: true,
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
  const prompt = `你是一位專業、親切且富有同理心的前端程式設計專屬導師。你正在一對一指導學生完成實作練習。

【重要稱謂與視角規範】：
所有評語、摘要、錯誤訊息與建議（summary、feedback、errors[].message、errors[].suggestion），主詞必須一律使用「你」（第二人稱），直接對學生說話。絕對不要出現「學生」、「該生」、「學生提交的程式碼」等第三人稱！

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

【你目前提交之代碼（Student Code）】：
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

【打分標準與評核規則（寬容評分、滿足條件即滿分）】：
1. 【未修改初始代碼】：若你提交的代碼與題目初始代碼（Starter Code）完全相同或實質為空，評 0 分，passed 為 false。summary 請明確寫：「你尚未修改初始程式碼，請依照題目指示開始動手練習！」，feedback 給予鼓勵指引。
2. 【滿足條件即打滿分 100 分（極重要）】：
   - 只要你的程式碼有滿足題目指示（instructions）或檢核清單（checklist）中的要求（例如本題要求使用 :hover 與 ::before，只要 CSS 中有包含對應的選擇器與屬性設定），就必須給予 100 分滿分，且 passed 必須為 true！
   - 哪怕你寫法簡潔、顏色值或文字內容與參考解答不同，只要功能與核心語法滿足，一律給 100 分滿分！
   - 題目中若提及多個可選標籤或屬性（例如語意標籤庫），絕非要求每一種都要寫出來，只要核心語意或目標達成即給滿分！
3. 【延伸優化建議「只在評語延伸，嚴禁扣分」】：
   - 任何關於排版美化、多餘屬性、未使用的其他進階技巧等，請務必只在 feedback 學習評語中做正面讚賞與補充延伸教學，絕對不可因此扣分！滿分依然給 100 分！
4. 【扣分標準規範（僅在缺少一兩個較重要代碼時才扣分）】：
   - 只有在確實缺少題目要求的一兩個較關鍵代碼或重要語法時才酌情扣分：
     * 例如：題目要求兩項核心任務，你完成了其中一項，但另一項重要代碼遺漏：給予 75 ~ 85 分，passed 為 true。
     * 若核心要求完成大半但語法有少許偏差：給予 85 ~ 95 分，passed 為 true。
     * 若缺少多數關鍵代碼，僅寫了極少無關內容：給予 40 ~ 55 分，passed 為 false。
   - 只要分數達到 60 分以上，passed 就必須設為 true！
5. 【錯誤指引規範】：
   - errors 陣列：若程式碼基本正確且通過（passed: true），**errors 必須為空陣列 []**！不要把優化建議當成錯誤放入 errors 中！
   - 只有在真正未通過或有嚴重語法錯誤時，才在 errors 內填寫具體項目。
6. 【標籤引用與反引號規範（極重要）】：在 summary、feedback、errors[].message、errors[].suggestion 中提及任何 HTML 標籤或程式代碼片段時（如 \`<body>\`、\`<h1>\`、\`<div>\`、\`<style>\` 等），務必使用反引號（\`）包裹，例如 \`<header>\`、\`<h1>標題</h1>\`，絕不可裸寫標籤以避免網頁 HTML 渲染異常。
7. 【格式規定】：必須以純 JSON 格式回傳，請勿夾帶任何 markdown 代碼塊標記。

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
