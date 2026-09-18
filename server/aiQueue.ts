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

【打分標準與評核規則（寬容評分、鼓勵優先）】：
1. 【未修改初始代碼】：若你提交的代碼與題目初始代碼（Starter Code）完全相同或實質為空，評 0 分，passed 為 false。summary 請明確寫：「你尚未修改初始程式碼，請依照題目指示開始動手練習！」，feedback 給予鼓勵指引。
2. 【大幅放寬評分標準，不要因非必要標籤扣分（極重要）】：
   - 題目中若提及多個語意化標籤（例如「header、nav、main、section、article、footer」），這些通常是本單元介紹的標籤庫，**絕非要求你必須把每一個標籤都硬塞進程式碼中**！
   - 只要你成功將原本程式碼中的主要 div 替換為對應的合理語意標籤（例如 top 換成 header、bottom 換成 footer、post 換成 article 或 section、外面包 main），**就屬於非常出色的實作，必須給予 85 到 100 分的高分，且 passed 必須為 true**！
   - **絕對不要因為代碼中缺少 <nav> 而扣分**！因為原始題目本身就沒有導覽列內容。
   - **絕對不要因為沒有同時使用 <section> 與 <article>、或沒有在 article 外面再包 section 而扣分**！兩者擇一合理使用即可。
   - **絕對不要因為標題使用 <h2>、<h3> 而非 <h1> 而扣分**！只要有運用到標題標籤的概念即可。
3. 【延伸優化建議「只在評語提醒，嚴禁扣分」】：
   - 如果你想提醒學生「未來若有導覽列可以加入 \`<nav>\`」、「主標題若用 \`<h1>\` 會更明確」、「article 外部也可依需要考慮 section」等優化方向，**請務必只在 feedback 學習評語中以親切、讚美的方式作為補充提示，絕對不可以將其當作扣分依據！**
   - 示範評語語氣：「你太棒了！已經成功將 div 轉換為 header、main、article 和 footer 等語意標籤，結構非常清晰！小提示：未來如果網頁有連結選單，也可以嘗試使用 \`<nav>\` 標籤喔～這次的表現非常優秀，繼續保持！」
4. 【扣分與通過門檻規範】：
   - 只要核心語意有改寫出來，基本分從 85 分起跳（85 ~ 100 分）。
   - 若只有部分轉換（例如只改了一兩個標籤，其他大部分仍是 div），給予 65 ~ 80 分。
   - 只要分數達到 60 分以上，passed 就必須設為 true！
   - 只有在完全未修改（0分）或嚴重破壞代碼結構時，才給予 60 分以下。
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
