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
 * 呼叫後端 Gemini Vertex AI 審核代碼
 */
export async function verifyPracticeWithAI(
  payload: VerifyPracticePayload,
  onQueueAlert?: (msg: string) => void,
): Promise<AiVerificationResult> {
  // 檢查是否佇列繁忙
  try {
    const queueStatusRes = await fetch('/api/ai/queue-status')
    if (queueStatusRes.ok) {
      const q = await queueStatusRes.json()
      if (q.isBusy && onQueueAlert) {
        onQueueAlert('⚠️ 伺服器繁忙（AI 請求佇列中），正在為你排隊審核，請稍候...')
      }
    }
  } catch {
    // 忽略
  }

  try {
    const response = await fetch('/api/ai/verify-practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.status === 429) {
      if (onQueueAlert) {
        onQueueAlert('⚠️ 伺服器繁忙，AI 請求超出每分鐘限制，正在排隊等待重試中...')
      }
      // 等待 4 秒後重試一次
      await new Promise((r) => setTimeout(r, 4000))
      const retryRes = await fetch('/api/ai/verify-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!retryRes.ok) {
        throw new Error('伺服器目前仍繁忙，請稍候 10 秒後再試。')
      }
      const retryData = await retryRes.json()
      await recordSubmissionToSupabase(payload, retryData)
      return retryData
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.message || errData.error || `HTTP ${response.status}`)
    }

    const data = (await response.json()) as AiVerificationResult

    // 通過時同步紀錄至 Supabase
    await recordSubmissionToSupabase(payload, data)

    return data
  } catch (err: any) {
    console.error('Gemini 審核請求失敗：', err)
    return {
      success: false,
      passed: false,
      score: 0,
      summary: '審核暫時無法完成',
      feedback: '無法連線至 AI 批改伺服器，請確保後端服務已啟動（npm run server），或稍候再試。',
      errors: [
        {
          panel: 'html',
          message: err?.message || '伺服器連線異常',
          suggestion: '請檢查網絡連線或洽詢助教。',
        },
      ],
      checklistStatus: [],
      error: err?.message || 'AI 服務異常',
    }
  }
}

async function recordSubmissionToSupabase(
  payload: VerifyPracticePayload,
  result: AiVerificationResult,
) {
  try {
    await supabase.from('practice_submissions').insert({
      student_id: payload.studentId,
      student_name: payload.studentName,
      lesson_id: payload.lessonId,
      code: JSON.stringify(payload.studentCode),
      completed: result.passed,
      score: result.score,
      ai_feedback: result.summary + '\n' + (result.feedback || ''),
    })
  } catch (e) {
    console.warn('同步至 Supabase 略過：', e)
  }
}
