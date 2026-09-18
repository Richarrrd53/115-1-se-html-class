import { supabase } from './supabase'
import {
  type CourseMember,
  normalizeName,
  normalizeStudentId,
  findLocalMember,
} from './courseMembers'

export interface VerificationResult {
  valid: boolean
  member?: CourseMember
  error?: string
}

export const ERROR_NOT_IN_COURSE = '錯誤！你目前沒有在課程中，請檢查你的學號/姓名是否正確！'

/**
 * 驗證學號與姓名是否在課程成員資料庫中。
 * 支援三層驗證：
 * 1. Supabase 資料庫 (course_members 資料表)
 * 2. 本地後端 API (/api/members/verify)
 * 3. 離線完整成員名單備援 (75 位成員)
 */
export async function verifyCourseMember(
  studentId: string,
  name: string,
): Promise<VerificationResult> {
  const normId = normalizeStudentId(studentId)
  const normName = normalizeName(name)

  if (!normId || !normName) {
    return {
      valid: false,
      error: '請輸入學號與姓名。',
    }
  }

  // 1. 嘗試由 Supabase course_members 查詢（若資料表尚未建立則靜默略過）
  try {
    const { data, error } = await supabase
      .from('course_members')
      .select('student_id, name, email')
      .eq('student_id', normId)
      .maybeSingle()

    if (!error && data) {
      if (normalizeName(data.name) === normName) {
        return {
          valid: true,
          member: {
            studentId: data.student_id,
            name: data.name,
            email: data.email,
          },
        }
      } else {
        // 學號存在但姓名不符
        return {
          valid: false,
          error: ERROR_NOT_IN_COURSE,
        }
      }
    }
    // If error code is relation not found (42P01) or table not found, skip silently
    // and fall through to local roster
  } catch {
    // Table may not exist – silently fall through to local roster
  }

  // 2. 離線/靜態名冊備援比對（Vercel 無後端時直接跳過 /api/members/verify）
  const localMatch = findLocalMember(normId, normName)
  if (localMatch) {
    return {
      valid: true,
      member: localMatch,
    }
  }

  // 3. 嘗試呼叫本地後端 API（僅在本機開發時有效，Vercel 靜態部署下自動略過）
  try {
    const res = await fetch('/api/members/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: normId, name }),
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const result = await res.json()
      if (result.valid) {
        return {
          valid: true,
          member: result.member,
        }
      }
    }
  } catch {
    // Backend not available (Vercel static) – silently skip
  }

  // 找不到學號或姓名不符 → 拒絕驗證
  return {
    valid: false,
    error: ERROR_NOT_IN_COURSE,
  }
}
