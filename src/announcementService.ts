import { ref, computed } from 'vue'
import { supabase } from './supabase'

export interface Announcement {
  id: string
  title: string
  content: string
  tag?: string
  isPinned?: boolean
  createdAt: string
  updatedAt?: string
}

const STORAGE_KEY_ANNOUNCEMENTS = 'webcraft_announcements_v1'
const READ_STORAGE_PREFIX = 'webcraft_read_announcements_'
const DISMISSED_BUBBLE_PREFIX = 'webcraft_dismissed_bubble_'

export const defaultAnnouncements: Announcement[] = [
  {
    id: 'ann-init-1',
    title: '歡迎使用 WebCraft 前端實作學習平台！',
    content: `各位同學好！歡迎來到網頁程式設計實作課程。\n\n- **實作編輯器**：左側為教材與範例說明，右側可直接編寫 HTML / CSS / JavaScript 並即時預覽效果。\n- **智慧補全**：編輯器現已全面支援智慧標籤與樣式補全。\n- **AI 診斷**：提交練習後，AI 助教會即時為你的程式碼提供精確回饋與評分。\n- **線上諮詢**：練習遇到問題時，隨時點擊右下角助教聊天室提問！`,
    tag: '重要',
    isPinned: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ann-init-2',
    title: '實作練習編輯器支援客製化關鍵字與全方位語法補全',
    content: `系統功能更新公告：\n- 實作題目現在支援管理員設定的客製化語法補全建議。\n- 支援 HTML 標籤、CSS 常用屬性以及 JS 關鍵字的即時提示。\n- 請同學們多多嘗試多行輸入與快捷鍵補全！`,
    tag: '更新',
    isPinned: false,
    createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
  }
]

function getInitialAnnouncements(): Announcement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANNOUNCEMENTS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('無法從 localStorage 讀取公告，使用預設值', e)
  }
  return JSON.parse(JSON.stringify(defaultAnnouncements))
}

export const announcements = ref<Announcement[]>(getInitialAnnouncements())
export const isLoadingAnnouncements = ref(false)
export const lastAnnouncementsSyncTime = ref<string | null>(null)

// 讀取狀態集合
export const readAnnouncementIds = ref<Set<string>>(new Set())
export const isBubbleDismissed = ref(false)

export function initStudentReadState(studentId: string) {
  const sid = studentId.trim() || 'anonymous'
  try {
    const raw = localStorage.getItem(`${READ_STORAGE_PREFIX}${sid}`)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        readAnnouncementIds.value = new Set(arr)
      } else {
        readAnnouncementIds.value = new Set()
      }
    } else {
      readAnnouncementIds.value = new Set()
    }

    const dismissedKey = `${DISMISSED_BUBBLE_PREFIX}${sid}`
    const lastDismissedTime = localStorage.getItem(dismissedKey)
    if (lastDismissedTime) {
      // 檢查在上次關閉泡泡之後，是否有更新的公告發佈
      const latestAnnTime = Math.max(...announcements.value.map(a => new Date(a.createdAt).getTime()), 0)
      if (latestAnnTime <= parseInt(lastDismissedTime, 10)) {
        isBubbleDismissed.value = true
      } else {
        isBubbleDismissed.value = false
      }
    } else {
      isBubbleDismissed.value = false
    }
  } catch {
    readAnnouncementIds.value = new Set()
    isBubbleDismissed.value = false
  }
}

export function markAnnouncementAsRead(id: string, studentId: string) {
  const sid = studentId.trim() || 'anonymous'
  readAnnouncementIds.value.add(id)
  try {
    localStorage.setItem(
      `${READ_STORAGE_PREFIX}${sid}`,
      JSON.stringify(Array.from(readAnnouncementIds.value))
    )
  } catch (err) {
    console.warn('儲存已讀公告失敗', err)
  }
}

export function markAllAnnouncementsAsRead(studentId: string) {
  const sid = studentId.trim() || 'anonymous'
  announcements.value.forEach(a => readAnnouncementIds.value.add(a.id))
  try {
    localStorage.setItem(
      `${READ_STORAGE_PREFIX}${sid}`,
      JSON.stringify(Array.from(readAnnouncementIds.value))
    )
  } catch (err) {
    console.warn('儲存已讀公告失敗', err)
  }
  isBubbleDismissed.value = true
  try {
    localStorage.setItem(`${DISMISSED_BUBBLE_PREFIX}${sid}`, String(Date.now()))
  } catch {}
}

export function dismissAnnouncementBubble(studentId: string) {
  const sid = studentId.trim() || 'anonymous'
  isBubbleDismissed.value = true
  try {
    localStorage.setItem(`${DISMISSED_BUBBLE_PREFIX}${sid}`, String(Date.now()))
  } catch {}
}

export const unreadAnnouncementsCount = computed(() => {
  return announcements.value.filter(a => !readAnnouncementIds.value.has(a.id)).length
})

export const hasUnreadAnnouncements = computed(() => {
  return unreadAnnouncementsCount.value > 0
})

export const sortedAnnouncements = computed(() => {
  return [...announcements.value].sort((a, b) => {
    // 置頂優先
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    // 日期新到舊
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})

function broadcastAnnouncements() {
  if (typeof window === 'undefined') return
  try {
    const data = JSON.parse(JSON.stringify(announcements.value))
    window.dispatchEvent(new CustomEvent('webcraft-announcements-changed', { detail: data }))
    window.postMessage({ type: 'WEBCRAFT_ANNOUNCEMENTS_UPDATED', data }, '*')
  } catch {}
}

/**
 * 從雲端資料庫讀取最新公告
 */
export async function fetchAnnouncementsFromDb(): Promise<Announcement[]> {
  isLoadingAnnouncements.value = true
  try {
    // 1. 優先從 course_content (id = 'announcements') 讀取
    try {
      const { data, error } = await supabase
        .from('course_content')
        .select('lessons, updated_at')
        .eq('id', 'announcements')
        .maybeSingle()

      if (!error && data?.lessons && Array.isArray(data.lessons) && data.lessons.length > 0) {
        announcements.value = data.lessons as Announcement[]
        lastAnnouncementsSyncTime.value = data.updated_at || new Date().toISOString()
        localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(announcements.value))
        broadcastAnnouncements()
        return announcements.value
      }
    } catch {}

    // 2. 備援讀取：practice_submissions (student_id = '__SYSTEM_ANNOUNCEMENTS__')
    try {
      const { data, error } = await supabase
        .from('practice_submissions')
        .select('code, created_at')
        .eq('student_id', '__SYSTEM_ANNOUNCEMENTS__')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0 && data[0].code) {
        const parsed = JSON.parse(data[0].code)
        if (Array.isArray(parsed) && parsed.length > 0) {
          announcements.value = parsed
          lastAnnouncementsSyncTime.value = data[0].created_at || new Date().toISOString()
          localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(announcements.value))
          broadcastAnnouncements()
          return announcements.value
        }
      }
    } catch {}

    // 3. 本地儲存兜底
    const local = getInitialAnnouncements()
    announcements.value = local
    return local
  } finally {
    isLoadingAnnouncements.value = false
  }
}

/**
 * 儲存公告（同時更新本地與雲端 Supabase）
 */
export async function saveAnnouncementsToDb(newAnnouncements: Announcement[]): Promise<{ success: boolean; message: string }> {
  isLoadingAnnouncements.value = true
  try {
    announcements.value = JSON.parse(JSON.stringify(newAnnouncements))
    localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(announcements.value))
    broadcastAnnouncements()

    const nowIso = new Date().toISOString()

    // 1. 寫入 course_content (id: 'announcements')
    let cloudSaved = false
    try {
      const { error: upsertErr } = await supabase
        .from('course_content')
        .upsert({
          id: 'announcements',
          stages: [],
          lessons: announcements.value,
          updated_at: nowIso,
        })
      if (!upsertErr) {
        cloudSaved = true
      }
    } catch (e) {
      console.warn('寫入 course_content 公告失敗:', e)
    }

    // 2. 寫入 practice_submissions 備援
    try {
      await supabase.from('practice_submissions').insert({
        student_id: '__SYSTEM_ANNOUNCEMENTS__',
        student_name: '系統公告備份',
        lesson_id: '__ANNOUNCEMENTS__',
        code: JSON.stringify(announcements.value),
        completed: true,
        score: 100,
      })
      cloudSaved = true
    } catch (e) {
      console.warn('寫入 practice_submissions 公告備份失敗:', e)
    }

    lastAnnouncementsSyncTime.value = nowIso
    return {
      success: true,
      message: cloudSaved ? '公告已成功同步至雲端與本地！' : '公告已儲存於本機（雲端連線失敗，請檢查網路）',
    }
  } catch (err: any) {
    return {
      success: false,
      message: `儲存公告失敗：${err?.message || err}`,
    }
  } finally {
    isLoadingAnnouncements.value = false
  }
}
