import { supabase } from './supabase'
import {
  type CourseMember,
  normalizeName,
  normalizeStudentId,
  findLocalMember,
  COURSE_MEMBERS,
} from './courseMembers'

export interface VerificationResult {
  valid: boolean
  member?: CourseMember
  error?: string
}

export const ERROR_NOT_IN_COURSE = '錯誤！你目前沒有在課程中，請檢查你的學號/姓名是否正確！'

// 記錄 course_members 資料表是否可用（避免反覆觸發 404 請求）
let courseMembersTableAvailable: boolean | null = null

/**
 * 驗證學號與姓名是否在課程成員資料庫中。
 * 驗證順序：
 * 1. 本地靜態名冊（優先，Vercel 靜態環境最可靠，完整 75 位成員均已內建）
 * 2. Supabase course_members 資料表（若確認資料表存在才查詢，否則略過）
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

  // 1. 優先查詢本地靜態名冊（在 Vercel 靜態環境最可靠，無需任何網路請求）
  const localMatch = findLocalMember(normId, normName)
  if (localMatch) {
    return {
      valid: true,
      member: localMatch,
    }
  }

  // 若學號在本地名冊中存在但姓名不符，直接返回錯誤（避免不必要的網路請求）
  const idExistsLocally = COURSE_MEMBERS.some(
    (m) => normalizeStudentId(m.studentId) === normId,
  )
  if (idExistsLocally) {
    return {
      valid: false,
      error: ERROR_NOT_IN_COURSE,
    }
  }

  // 2. 嘗試由 Supabase course_members 查詢（僅在確認資料表可用時才查，避免觸發 404）
  if (courseMembersTableAvailable !== false) {
    try {
      const { data, error } = await supabase
        .from('course_members')
        .select('student_id, name, email')
        .eq('student_id', normId)
        .maybeSingle()

      if (error) {
        // 若資料表不存在（404）則標記為不可用，後續不再查詢
        courseMembersTableAvailable = false
      } else {
        courseMembersTableAvailable = true
        if (data) {
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
            return {
              valid: false,
              error: ERROR_NOT_IN_COURSE,
            }
          }
        }
      }
    } catch {
      courseMembersTableAvailable = false
    }
  }

  // 學號在本地及資料庫均查無此人
  return {
    valid: false,
    error: ERROR_NOT_IN_COURSE,
  }
}

