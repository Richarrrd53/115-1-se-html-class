import { supabase } from './supabase'

export interface ChatMessage {
  id: number
  student_id: string
  student_name: string
  sender_role: 'student' | 'ta'
  content: string
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_type?: string | null
  reply_to_id?: number | null
  is_recalled: boolean
  likes: number
  liked_by?: string[]
  is_read_by_ta: boolean
  is_read_by_student: boolean
  created_at: string
}

export interface TaConversationSummary {
  student_id: string
  student_name: string
  last_message: string
  last_message_at: string
  unread_count: number
  has_unread: boolean
}

export interface SendMessageParams {
  student_id: string
  student_name: string
  sender_role: 'student' | 'ta'
  content: string
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_type?: string | null
  reply_to_id?: number | null
}

const LOCAL_STORAGE_MESSAGES_KEY = 'webcraft_local_chat_messages_v1'
const LOCAL_STORAGE_PASSWORDS_KEY = 'webcraft_local_chat_passwords_v1'

/**
 * 計算字串的 SHA-256 雜湊
 */
export async function hashPassword(plainText: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plainText.trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toLowerCase()
}

/**
 * 本地 Storage 備援 Helper
 */
function getLocalMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MESSAGES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalMessages(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_MESSAGES_KEY, JSON.stringify(msgs))
  } catch {}
}

function getLocalPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PASSWORDS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalPasswords(map: Record<string, string>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PASSWORDS_KEY, JSON.stringify(map))
  } catch {}
}

/**
 * 上傳檔案至 Supabase Storage (Bucket: message_attach)
 * 若 Storage 不可用則降級為 DataURL Base64
 */
export async function uploadAttachment(
  file: File,
): Promise<{ url: string; name: string; type: string }> {
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '')
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${cleanName}`
  const filePath = `chat/${fileName}`

  try {
    const { data, error } = await supabase.storage
      .from('message_attach')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (!error && data) {
      const { data: pubData } = supabase.storage
        .from('message_attach')
        .getPublicUrl(filePath)
      if (pubData?.publicUrl) {
        return {
          url: pubData.publicUrl,
          name: file.name,
          type: file.type || 'image/png',
        }
      }
    }
    console.warn('Supabase storage upload returned error or no data, falling back to base64:', error)
  } catch (err) {
    console.warn('Supabase storage unavailable, falling back to base64:', err)
  }

  // 備援轉換為 Base64 Data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        url: String(reader.result),
        name: file.name,
        type: file.type || 'image/png',
      })
    }
    reader.onerror = (e) => reject(e)
    reader.readAsDataURL(file)
  })
}

export interface ChatAttachment {
  url: string
  name: string
  type: string
}

/**
 * 上傳多個檔案至 Supabase Storage (Bucket: message_attach)
 */
export async function uploadMultipleAttachments(
  files: File[],
): Promise<ChatAttachment[]> {
  const results = await Promise.all(files.map((file) => uploadAttachment(file)))
  return results
}

/**
 * 解析訊息的附件列表（相容單一 attachment_url 或 JSON 陣列）
 */
export function getMessageAttachments(msg: ChatMessage): ChatAttachment[] {
  if (!msg.attachment_url) return []
  const raw = msg.attachment_url.trim()
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && item.url)
      }
    } catch {}
  }
  return [
    {
      url: msg.attachment_url,
      name: msg.attachment_name || '附件圖片',
      type: msg.attachment_type || 'image/png',
    },
  ]
}

/**
 * 檢查學生是否有過對話紀錄
 */
export async function checkStudentHasHistory(studentId: string): Promise<boolean> {
  const normId = studentId.trim()
  if (!normId) return false

  try {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', normId)

    if (!error && typeof count === 'number') {
      if (count > 0) return true
    }
  } catch {}

  const locals = getLocalMessages()
  return locals.some((m) => m.student_id === normId)
}

/**
 * 取得特定學生的完整訊息列表
 */
export async function fetchStudentMessages(studentId: string): Promise<ChatMessage[]> {
  const normId = studentId.trim()
  if (!normId) return []

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('student_id', normId)
      .order('created_at', { ascending: true })

    if (!error && Array.isArray(data)) {
      // 確保格式一致
      return data.map((d: any) => ({
        ...d,
        liked_by: Array.isArray(d.liked_by) ? d.liked_by : [],
      }))
    }
  } catch (err) {
    console.warn('讀取遠端訊息失敗，改用本地紀錄:', err)
  }

  const locals = getLocalMessages().filter((m) => m.student_id === normId)
  return locals.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

/**
 * 發送新訊息
 */
export async function sendMessage(params: SendMessageParams): Promise<ChatMessage> {
  const newMsg: Partial<ChatMessage> = {
    student_id: params.student_id.trim(),
    student_name: params.student_name.trim(),
    sender_role: params.sender_role,
    content: params.content.trim(),
    attachment_url: params.attachment_url || null,
    attachment_name: params.attachment_name || null,
    attachment_type: params.attachment_type || null,
    reply_to_id: params.reply_to_id || null,
    is_recalled: false,
    likes: 0,
    liked_by: [],
    is_read_by_ta: params.sender_role === 'ta',
    is_read_by_student: params.sender_role === 'student',
    created_at: new Date().toISOString(),
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(newMsg)
      .select()
      .single()

    if (!error && data) {
      return {
        ...data,
        liked_by: Array.isArray(data.liked_by) ? data.liked_by : [],
      }
    }
  } catch (err) {
    console.warn('寫入 Supabase 失敗，使用本地備援:', err)
  }

  // 本地備援儲存
  const localList = getLocalMessages()
  const fallbackId = Date.now() + Math.floor(Math.random() * 1000)
  const fullMsg: ChatMessage = {
    ...(newMsg as any),
    id: fallbackId,
  }
  localList.push(fullMsg)
  saveLocalMessages(localList)
  return fullMsg
}

/**
 * 收回訊息
 */
export async function recallMessage(messageId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_recalled: true, content: '', attachment_url: null })
      .eq('id', messageId)

    if (!error) return true
  } catch {}

  const locals = getLocalMessages()
  const idx = locals.findIndex((m) => m.id === messageId)
  if (idx !== -1) {
    locals[idx].is_recalled = true
    locals[idx].content = ''
    locals[idx].attachment_url = null
    saveLocalMessages(locals)
    return true
  }
  return false
}

/**
 * 徹底刪除單一訊息 (當只有一則訊息且被收回時，清空紀錄)
 */
export async function deleteMessage(messageId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)

    if (!error) {
      const locals = getLocalMessages().filter((m) => m.id !== messageId)
      saveLocalMessages(locals)
      return true
    }
  } catch {}

  const locals = getLocalMessages().filter((m) => m.id !== messageId)
  saveLocalMessages(locals)
  return true
}

/**
 * 按讚或取消讚
 */
export async function toggleLikeMessage(
  messageId: number,
  userId: string,
): Promise<{ likes: number; isLiked: boolean }> {
  let curMsg: ChatMessage | null = null

  try {
    const { data } = await supabase
      .from('chat_messages')
      .select('likes, liked_by')
      .eq('id', messageId)
      .single()

    if (data) {
      curMsg = data as ChatMessage
    }
  } catch {}

  if (!curMsg) {
    const locals = getLocalMessages()
    curMsg = locals.find((m) => m.id === messageId) || null
  }

  const currentLikedBy = Array.isArray(curMsg?.liked_by) ? [...curMsg!.liked_by] : []
  const userIndex = currentLikedBy.indexOf(userId)
  let isLiked = false

  if (userIndex >= 0) {
    currentLikedBy.splice(userIndex, 1)
    isLiked = false
  } else {
    currentLikedBy.push(userId)
    isLiked = true
  }

  const newLikesCount = Math.max(0, currentLikedBy.length)

  try {
    await supabase
      .from('chat_messages')
      .update({
        likes: newLikesCount,
        liked_by: currentLikedBy,
      })
      .eq('id', messageId)
  } catch {}

  const locals = getLocalMessages()
  const idx = locals.findIndex((m) => m.id === messageId)
  if (idx !== -1) {
    locals[idx].likes = newLikesCount
    locals[idx].liked_by = currentLikedBy
    saveLocalMessages(locals)
  }

  return { likes: newLikesCount, isLiked }
}

/**
 * 檢查學生是否已設定密碼
 */
export async function getStudentHasPassword(studentId: string): Promise<boolean> {
  const normId = studentId.trim()
  if (!normId) return false

  try {
    const { data, error } = await supabase
      .from('student_chat_auth')
      .select('password_hash')
      .eq('student_id', normId)
      .maybeSingle()

    if (!error && data?.password_hash) {
      return true
    }
  } catch {}

  const localMap = getLocalPasswords()
  return Boolean(localMap[normId])
}

/**
 * 設定學生聊天防護密碼
 */
export async function setStudentChatPassword(
  studentId: string,
  studentName: string,
  plainPassword: string,
): Promise<boolean> {
  const normId = studentId.trim()
  const passHash = await hashPassword(plainPassword)

  try {
    const { error } = await supabase
      .from('student_chat_auth')
      .upsert(
        {
          student_id: normId,
          student_name: studentName.trim(),
          password_hash: passHash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id' },
      )

    if (!error) {
      const localMap = getLocalPasswords()
      localMap[normId] = passHash
      saveLocalPasswords(localMap)
      return true
    }
  } catch {}

  const localMap = getLocalPasswords()
  localMap[normId] = passHash
  saveLocalPasswords(localMap)
  return true
}

/**
 * 驗證學生聊天防護密碼
 */
export async function verifyStudentChatPassword(
  studentId: string,
  plainPassword: string,
): Promise<boolean> {
  const normId = studentId.trim()
  const inputHash = await hashPassword(plainPassword)

  try {
    const { data, error } = await supabase
      .from('student_chat_auth')
      .select('password_hash')
      .eq('student_id', normId)
      .maybeSingle()

    if (!error && data?.password_hash) {
      return data.password_hash === inputHash
    }
  } catch {}

  const localMap = getLocalPasswords()
  if (localMap[normId]) {
    return localMap[normId] === inputHash
  }

  return false
}

/**
 * 助教端：取得所有發送過訊息的學生清單與最新訊息摘要
 */
export async function fetchTaConversations(): Promise<TaConversationSummary[]> {
  let allMessages: ChatMessage[] = []

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      allMessages = data as ChatMessage[]
    }
  } catch {}

  if (!allMessages.length) {
    allMessages = getLocalMessages().sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }

  // 依照學生 ID 分組
  const studentMap = new Map<string, {
    student_id: string
    student_name: string
    last_message: string
    last_message_at: string
    unread_count: number
  }>()

  for (const msg of allMessages) {
    if (!studentMap.has(msg.student_id)) {
      studentMap.set(msg.student_id, {
        student_id: msg.student_id,
        student_name: msg.student_name || msg.student_id,
        last_message: msg.is_recalled
          ? '（訊息已收回）'
          : msg.content || (msg.attachment_url ? '［圖片附件］' : ''),
        last_message_at: msg.created_at,
        unread_count: 0,
      })
    }

    const entry = studentMap.get(msg.student_id)!
    if (msg.sender_role === 'student' && !msg.is_read_by_ta) {
      entry.unread_count += 1
    }
  }

  return Array.from(studentMap.values()).map((s) => ({
    ...s,
    has_unread: s.unread_count > 0,
  }))
}

/**
 * 標記對話為已讀
 */
export async function markConversationAsRead(
  studentId: string,
  role: 'student' | 'ta',
): Promise<void> {
  const normId = studentId.trim()
  try {
    if (role === 'ta') {
      await supabase
        .from('chat_messages')
        .update({ is_read_by_ta: true })
        .eq('student_id', normId)
        .eq('sender_role', 'student')
        .eq('is_read_by_ta', false)
    } else {
      await supabase
        .from('chat_messages')
        .update({ is_read_by_student: true })
        .eq('student_id', normId)
        .eq('sender_role', 'ta')
        .eq('is_read_by_student', false)
    }
  } catch {}

  const locals = getLocalMessages()
  let modified = false
  for (const m of locals) {
    if (m.student_id === normId) {
      if (role === 'ta' && m.sender_role === 'student' && !m.is_read_by_ta) {
        m.is_read_by_ta = true
        modified = true
      } else if (role === 'student' && m.sender_role === 'ta' && !m.is_read_by_student) {
        m.is_read_by_student = true
        modified = true
      }
    }
  }
  if (modified) saveLocalMessages(locals)
}
