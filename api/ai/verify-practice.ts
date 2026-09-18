import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'project-ab68aaa2-ad0c-4e95-973'
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

let ai: GoogleGenAI | null = null
try {
  ai = new GoogleGenAI({ vertexai: true, project: projectId, location })
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
    '你是一位專業、親切且富有同理心的前端程式設計專屬導師。你正在一對一指導學生完成實作練習。',
    '',
    '【重要稱謂與視角規範】：',
    '所有評語、摘要、錯誤訊息與建議（summary、feedback、errors[].message、errors[].suggestion），主詞必須一律使用「你」（第二人稱），直接對學生說話。絕對不要出現「學生」、「該生」、「學生提交的程式碼」等第三人稱！',
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
    `HTML:\n\`\`\`html\n${sc.html || ''}\n\`\`\``,
    `CSS:\n\`\`\`css\n${sc.css || ''}\n\`\`\``,
    `JavaScript:\n\`\`\`js\n${sc.js || ''}\n\`\`\``,
    '',
    '【預期標準參考解答（Expected Answer）】：',
    `HTML:\n\`\`\`html\n${ac.html || ''}\n\`\`\``,
    `CSS:\n\`\`\`css\n${ac.css || ''}\n\`\`\``,
    `JavaScript:\n\`\`\`js\n${ac.js || ''}\n\`\`\``,
    '',
    '【你目前提交之代碼（Student Code）】：',
    `HTML:\n\`\`\`html\n${stu.html || ''}\n\`\`\``,
    `CSS:\n\`\`\`css\n${sc.css || ''}\n\`\`\``,
    `JavaScript:\n\`\`\`js\n${sc.js || ''}\n\`\`\``,
    '',
    '【打分標準與評核規則（寬容評分、鼓勵優先）】：',
    '1. 【未修改初始代碼】：若你提交的代碼與題目初始代碼（Starter Code）完全相同或實質為空，評 0 分，passed 為 false。summary 請明確寫：「你尚未修改初始程式碼，請依照題目指示開始動手練習！」，feedback 給予鼓勵指引。',
    '2. 【大幅放寬評分標準，不要因非必要標籤扣分（極重要）】：',
    '   - 題目中若提及多個語意化標籤（例如「header、nav、main、section、article、footer」），這些通常是本單元介紹的標籤庫，絕非要求你必須把每一個標籤都硬塞進程式碼中！',
    '   - 只要你成功將原本程式碼中的主要 div 替換為對應的合理語意標籤（例如 top 換成 header、bottom 換成 footer、post 換成 article 或 section、外面包 main），就屬於非常出色的實作，必須給予 85 到 100 分的高分，且 passed 必須為 true！',
    '   - 絕對不要因為代碼中缺少 <nav> 而扣分！因為原始題目本身就沒有導覽列內容。',
    '   - 絕對不要因為沒有同時使用 <section> 與 <article>、或沒有在 article 外面再包 section 而扣分！兩者擇一合理使用即可。',
    '   - 絕對不要因為標題使用 <h2>、<h3> 而非 <h1> 而扣分！只要有運用到標題標籤的概念即可。',
    '3. 【延伸優化建議「只在評語提醒，嚴禁扣分」】：',
    '   - 如果你想提醒學生「未來若有導覽列可以加入 <nav>」、「主標題若用 <h1> 會更明確」、「article 外部也可依需要考慮 section」等優化方向，請務必只在 feedback 學習評語中以親切、讚美的方式作為補充提示，絕對不可以將其當作扣分依據！',
    '4. 【扣分與通過門檻規範】：',
    '   - 只要核心語意有改寫出來，基本分從 85 分起跳（85 ~ 100 分）。',
    '   - 若只有部分轉換（例如只改了一兩個標籤，其他大部分仍是 div），給予 65 ~ 80 分。',
    '   - 只要分數達到 60 分以上，passed 就必須設為 true！',
    '5. 【錯誤指引規範】：若通過（passed: true），errors 陣列必須為空 []！不要把優化建議當成錯誤放入 errors 中！',
    '6. 【格式規定】：必須以純 JSON 格式回傳，請勿夾帶任何 markdown 代碼塊標記。',
    '',
    'JSON 格式規範：',
    jsonSpec,
  ].join('\n')
}

// 智慧服務端語意檢核備援
function serverSemanticEvaluate(data: Record<string, any>) {
  const checklist: string[] = Array.isArray(data.checklist) ? data.checklist : []
  const starter = data.starterCode || { html: '', css: '', js: '' }
  const stu = data.studentCode || { html: '', css: '', js: '' }
  const html = (stu.html || '').trim()
  const css = (stu.css || '').trim()
  const js = (stu.js || '').trim()

  const starterHtml = (starter.html || '').trim()
  const starterCss = (starter.css || '').trim()
  const starterJs = (starter.js || '').trim()

  // 1. 與原始代碼一模一樣：0 分
  const isIdentical = html === starterHtml && css === starterCss && js === starterJs
  if (isIdentical || (!html && !css && !js)) {
    return {
      success: true,
      passed: false,
      score: 0,
      summary: '你尚未修改初始程式碼，請依照練習說明開始動手寫寫看喔！',
      feedback: '動手實作是學好網頁開發最快的方法，嘗試在編輯區輸入對應的程式碼吧！',
      errors: [
        {
          panel: 'html',
          line: 1,
          message: '你提交的程式碼與初始代碼完全相同',
          suggestion: '請對照題目說明與檢核清單，在編輯器中編寫程式碼後再進行驗證。',
        },
      ],
      checklistStatus: checklist.map((item) => ({ text: item, passed: false })),
    }
  }

  const errors: any[] = []
  const checklistStatus: any[] = []
  let passedCount = 0

  for (const item of checklist) {
    const itemLower = item.toLowerCase()
    let isPassed = false
    const tagMatch = item.match(/<([a-zA-Z0-9-]+)>/) || item.match(/`([a-zA-Z0-9-]+)`/)
    const targetTag = tagMatch ? tagMatch[1].toLowerCase() : null

    if (targetTag) {
      // 概念性彈性：若要求 h1~h6 任何標題標籤，只要有使用任意標題標籤均算具備標題概念
      if (/^h[1-6]$/.test(targetTag)) {
        isPassed = /<h[1-6](\s+[^>]*)?>/i.test(html)
      } else {
        isPassed = new RegExp(`<${targetTag}(\\s+[^>]*)?>`, 'i').test(html)
      }
    } else if (itemLower.includes('標題') || itemLower.includes('heading')) {
      isPassed = /<h[1-6](\s+[^>]*)?>/i.test(html)
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
      isPassed = css.length > 5 || /<style(\s+[^>]*)?>/i.test(html)
    } else if (itemLower.includes('js') || itemLower.includes('javascript')) {
      isPassed = js.length > 5 || /<script(\s+[^>]*)?>/i.test(html)
    } else {
      isPassed = html.length > 10
    }

    if (isPassed) passedCount++
    checklistStatus.push({ text: item, passed: isPassed })
  }

  const total = checklist.length || 1
  const ratio = passedCount / total

  // 全對100分，些許錯誤斟酌扣分，滿60分即及格
  let score = 0
  if (ratio >= 1.0) {
    score = 100
  } else if (ratio >= 0.8) {
    score = 85
  } else if (ratio >= 0.6) {
    score = 65
  } else {
    score = Math.round(ratio * 50)
  }

  const passed = score >= 60

  return {
    success: true,
    passed,
    score,
    summary: passed
      ? (score === 100 ? '你的實作完全符合所有題目要求，表現非常優秀！' : '你已達成大部分題目要求，順利通過驗證！')
      : '部分檢核項目尚未達成，請對照下方提示進行調整喔！',
    feedback: passed
      ? (score === 100 ? '程式碼語意結構非常規範，繼續保持！' : '很棒！你已經掌握了核心概念，若能微調細節會更加完美～')
      : '請確認題目要求的各個標籤與屬性是否都有正確填寫在對應的面板中。',
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
