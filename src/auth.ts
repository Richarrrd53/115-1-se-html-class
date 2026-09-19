import { supabase } from './supabase'

const AUTH_STORAGE_KEY = 'webcraft_editor_authenticated'

// 密碼 33550336 的 SHA-256 Hash
export const EXPECTED_EDITOR_HASH = 'a93bc952f6411dc3dc71a05bd138be30e5d6369ef94acdb98f55260141ef6b21'

/**
 * 使用原生 Web Crypto API 計算字串的 SHA-256 Hash
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password.trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase()
}

/**
 * 檢查目前會話是否已通過密碼驗證
 */
export function isEditorAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true'
}

/**
 * 設定會話認證狀態
 */
export function setEditorAuthenticated(authenticated: boolean) {
  if (typeof window === 'undefined') return
  if (authenticated) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'true')
  } else {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

/**
 * 透過資料庫（Supabase 或後端 API）驗證密碼 Hash
 */
export async function verifyEditorPassword(plainPassword: string): Promise<{ success: boolean; message: string }> {
  const inputHash = await hashPassword(plainPassword)

  // 2. 嘗試透過 Supabase admin_auth 資料表查詢
  try {
    const { data, error } = await supabase
      .from('admin_auth')
      .select('password_hash')
      .eq('role', 'editor')
      .maybeSingle()

    if (!error && data?.password_hash) {
      const dbHash = String(data.password_hash).trim().toLowerCase()
      if (inputHash === dbHash) {
        setEditorAuthenticated(true)
        return { success: true, message: '驗證成功！' }
      } else {
        return { success: false, message: '密碼錯誤，請重新輸入。' }
      }
    }
  } catch (err) {
    console.warn('查詢 Supabase admin_auth 失敗:', err)
  }

  // 3. 安全防護比對（當資料庫尚未建立表格時，比對 Hash 並嘗試自動將其寫入 Supabase 資料庫）
  if (inputHash === EXPECTED_EDITOR_HASH) {
    setEditorAuthenticated(true)
    // 背景嘗試在 Supabase 寫入紀錄
    Promise.resolve(
      supabase
        .from('admin_auth')
        .upsert({ role: 'editor', password_hash: EXPECTED_EDITOR_HASH }, { onConflict: 'role' }),
    ).catch(() => {})

    return { success: true, message: '驗證成功！' }
  }


  return { success: false, message: '密碼錯誤，請重新輸入。' }
}
