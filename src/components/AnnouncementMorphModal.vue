<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  sortedAnnouncements,
  unreadAnnouncementsCount,
  hasUnreadAnnouncements,
  isBubbleDismissed,
  initStudentReadState,
  markAnnouncementAsRead,
  markAllAnnouncementsAsRead,
  dismissAnnouncementBubble,
  fetchAnnouncementsFromDb,
} from '../announcementService'
import { renderMarkdown } from '../markdown'

const props = defineProps<{
  studentId?: string
}>()

watch(() => props.studentId, (sid) => {
  initStudentReadState(sid || '')
})

const triggerBtnRef = ref<HTMLButtonElement | null>(null)

// 浮動公告泡泡控制
const showBubble = computed(() => {
  return hasUnreadAnnouncements.value && !isBubbleDismissed.value
})

function handleDismissBubble(e?: MouseEvent) {
  if (e) e.stopPropagation()
  dismissAnnouncementBubble(props.studentId || '')
}

// ─────────────────────────────────────────────────────────────
// High-precision cubic-bezier solver for cubic-bezier(.4, 0, .2, 1)
// ─────────────────────────────────────────────────────────────
function createCubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx

  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  function sampleCurveX(t: number) {
    return ((ax * t + bx) * t + cx) * t
  }
  function sampleCurveY(t: number) {
    return ((ay * t + by) * t + cy) * t
  }
  function sampleCurveDerivativeX(t: number) {
    return (3 * ax * t + 2 * bx) * t + cx
  }

  function solveCurveX(x: number) {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const currentX = sampleCurveX(t) - x
      if (Math.abs(currentX) < 1e-6) return t
      const dX = sampleCurveDerivativeX(t)
      if (Math.abs(dX) < 1e-6) break
      t -= currentX / dX
    }
    let t0 = 0, t1 = 1
    t = x
    while (t0 < t1) {
      const currentX = sampleCurveX(t)
      if (Math.abs(currentX - x) < 1e-6) return t
      if (x > currentX) t0 = t
      else t1 = t
      t = (t1 + t0) / 2
    }
    return t
  }

  return function (x: number) {
    return sampleCurveY(solveCurveX(x))
  }
}

const easeStandard = createCubicBezier(0.4, 0, 0.2, 1)

function getQuadraticBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
) {
  const inv = 1 - t
  return {
    x: inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
    y: inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y,
  }
}

// ─────────────────────────────────────────────────────────────
// Morph Session State & Animation Controller
// ─────────────────────────────────────────────────────────────
interface MorphSession {
  overlay: HTMLElement
  menu: HTMLElement
  morphIcon: HTMLElement
  morphBadge: HTMLElement | null
  triggerBtn: HTMLElement
  p0: { x: number; y: number }
  p1: { x: number; y: number }
  p2: { x: number; y: number }
  finalCenter: { x: number; y: number }
  targetBounds: {
    targetLeft: number
    targetTop: number
    expandedWidth: number
    expandedHeight: number
  }
  rafId: number | null
}

let activeMorphSession: MorphSession | null = null
let cleanupTimer: ReturnType<typeof setTimeout> | null = null
const isModalOpen = ref(false)

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${d.getFullYear()}/${month}/${day} ${hour}:${min}`
  } catch {
    return iso
  }
}

function getTagClass(tag?: string) {
  if (!tag) return 'tag-default'
  if (tag.includes('重要')) return 'tag-important'
  if (tag.includes('更新')) return 'tag-update'
  if (tag.includes('作業') || tag.includes('活動')) return 'tag-activity'
  return 'tag-default'
}

function handleMarkAllAsRead() {
  markAllAnnouncementsAsRead(props.studentId || '')
}

function closeMorphModal(onComplete?: () => void) {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
    cleanupTimer = null
  }

  if (!activeMorphSession) {
    isModalOpen.value = false
    if (onComplete) onComplete()
    return
  }

  const session = activeMorphSession
  activeMorphSession = null
  isModalOpen.value = false

  if (session.rafId) {
    cancelAnimationFrame(session.rafId)
    session.rafId = null
  }

  const { overlay, menu, morphIcon, morphBadge, triggerBtn, p2, targetBounds } = session
  const { targetLeft, targetTop, expandedWidth, expandedHeight } = targetBounds

  // 動態獲取最新 trigger 按鈕矩形座標，確保 100% 零跳動精確閉合
  const liveRect = triggerBtn.getBoundingClientRect()
  const p0_target = {
    x: liveRect.left + liveRect.width / 2,
    y: liveRect.top + liveRect.height / 2,
  }

  // 折返飛行二次貝茲控制點（向上微弧 14px）
  const p1_return = {
    x: (p0_target.x + p2.x) / 2,
    y: Math.min(p0_target.y, p2.y) - 14,
  }

  const finalCenter = {
    x: targetLeft + expandedWidth / 2,
    y: targetTop + expandedHeight / 2,
  }

  // 觸發內容交錯融球回縮（延長隱藏時間約 140ms）
  menu.classList.remove('is-settled')
  menu.classList.remove('is-content-visible')
  menu.classList.add('is-items-collapsing')

  const closeStart = performance.now()
  const closeTotalDuration = 580 // ms (延長隱藏與收合整體時間，達到絲滑從容、徹底無閃爍的變形效果)

  function stepClose(now: number) {
    const elapsed = now - closeStart

    // 1. 統一飛行軌跡：在內容充分隱藏 (140ms) 後，自 p2 沿拋物線飛往 p0_target (140 - 360ms)
    let flightPt: { x: number; y: number }
    if (elapsed <= 140) {
      flightPt = p2
    } else if (elapsed <= 360) {
      const fp = (elapsed - 140) / 220
      const fEase = easeStandard(fp)
      flightPt = getQuadraticBezierPoint(p2, p1_return, p0_target, fEase)
    } else {
      flightPt = p0_target
    }

    // 2. 幾何收縮與形變
    let curW: number, curH: number, curCenterX: number, curCenterY: number, curRadius: number, curScale = 1

    if (elapsed < 140) {
      // 階段 A1: 內容交錯模糊與淡出 (0 - 140ms, 充分延長隱藏時間)，面板維持完整磨砂卡片狀態
      curW = expandedWidth
      curH = expandedHeight
      curRadius = 17
      curCenterX = finalCenter.x
      curCenterY = finalCenter.y
      morphIcon.style.opacity = '0'
      if (morphBadge) morphBadge.style.opacity = '0'
    } else if (elapsed < 320) {
      // 階段 A2: 內容已完全消隱；面板平滑融聚收縮為 20px 飛行圓點 (140 - 320ms, 歷時 180ms)
      // 圓角從 17px 平滑收縮至高與寬的一半 (10px)
      const cp = (elapsed - 140) / 180
      const cEase = easeStandard(cp)
      const invEase = 1 - cEase

      curW = 20 + (expandedWidth - 20) * invEase
      curH = 20 + (expandedHeight - 20) * invEase
      curRadius = 10 + 7 * invEase

      curCenterX = flightPt.x + (finalCenter.x - p2.x) * invEase
      curCenterY = flightPt.y + (finalCenter.y - p2.y) * invEase

      // 當面板接近收縮成 20px 圓點時 (cp >= 0.85)，平滑卸載浮動選單大陰影，杜絕全尺寸時的陰影閃爍
      if (cp >= 0.85 && menu.classList.contains('is-expanded')) {
        menu.classList.remove('is-expanded')
      }

      morphIcon.style.opacity = '0'
      if (morphBadge) morphBadge.style.opacity = '0'
    } else if (elapsed < 360) {
      // 階段 B: 純淨 20px 圓點滑行剩餘軌道抵達按鈕中心 p0_target (320 - 360ms)，半徑為 10px
      if (menu.classList.contains('is-expanded')) {
        menu.classList.remove('is-expanded')
      }
      curW = 20
      curH = 20
      curRadius = 10
      curCenterX = flightPt.x
      curCenterY = flightPt.y

      morphIcon.style.opacity = '0'
      if (morphBadge) morphBadge.style.opacity = '0'
    } else if (elapsed < closeTotalDuration) {
      // 階段 C: 圓點已在按鈕中心 p0_target；分配 220ms (360 - 580ms) 穩定成長 20px -> 36px
      const rp = (elapsed - 360) / 220
      const rEase = easeStandard(rp)

      const curSize = 20 + 16 * rEase
      curW = curSize
      curH = curSize
      curRadius = curSize / 2
      curCenterX = p0_target.x
      curCenterY = p0_target.y

      // 圖標與未讀紅點徽章在按鈕成長約 35% (約 26px) 時自中心伴隨模糊浮現
      const iconStart = 0.35
      if (rEase <= iconStart) {
        morphIcon.style.opacity = '0'
        morphIcon.style.filter = 'blur(5px)'
        morphIcon.style.transform = 'scale(0.7)'
        if (morphBadge) {
          morphBadge.style.opacity = '0'
          morphBadge.style.transform = 'scale(0.7)'
        }
      } else {
        const ip = (rEase - iconStart) / (1 - iconStart)
        const iEase = easeStandard(ip)
        morphIcon.style.opacity = iEase.toFixed(2)
        const blurVal = (5 * (1 - iEase)).toFixed(1)
        morphIcon.style.filter = Number(blurVal) > 0.1 ? `blur(${blurVal}px)` : 'none'
        morphIcon.style.transform = `scale(${(0.7 + 0.3 * iEase).toFixed(3)})`

        if (morphBadge && unreadAnnouncementsCount.value > 0) {
          morphBadge.style.opacity = iEase.toFixed(2)
          morphBadge.style.transform = `scale(${(0.7 + 0.3 * iEase).toFixed(3)})`
        }
      }

      // 阻尼微吸附歸位 (<= 1.004)
      const bump = Math.sin(rEase * Math.PI) * Math.max(0, 1 - 0.5 * rEase)
      curScale = 1 + 0.004 * bump
    } else {
      // 最終狀態精確吻合按鈕中心與尺寸
      curW = liveRect.width
      curH = liveRect.height
      curRadius = liveRect.height / 2
      curCenterX = p0_target.x
      curCenterY = p0_target.y
      curScale = 1
      morphIcon.style.opacity = '1'
      morphIcon.style.filter = 'none'
      morphIcon.style.transform = 'scale(1)'
      if (morphBadge && unreadAnnouncementsCount.value > 0) {
        morphBadge.style.opacity = '1'
        morphBadge.style.transform = 'scale(1)'
      }
    }

    menu.style.width = `${curW.toFixed(1)}px`
    menu.style.height = `${curH.toFixed(1)}px`
    menu.style.left = `${(curCenterX - curW / 2).toFixed(1)}px`
    menu.style.top = `${(curCenterY - curH / 2).toFixed(1)}px`
    menu.style.borderRadius = `${curRadius.toFixed(1)}px`
    menu.style.transform = `scale(${curScale.toFixed(4)})`

    if (elapsed < closeTotalDuration) {
      session.rafId = requestAnimationFrame(stepClose)
      return
    }

    // 1. 動畫完成：精確鎖定原按鈕絕對座標與尺寸 (消除任何微米級四捨五入誤差)
    menu.style.left = `${liveRect.left}px`
    menu.style.top = `${liveRect.top}px`
    menu.style.width = `${liveRect.width}px`
    menu.style.height = `${liveRect.height}px`
    menu.style.borderRadius = `${liveRect.height / 2}px`
    menu.style.transform = 'none'
    menu.style.opacity = '1'
    menu.style.filter = 'none'
    morphIcon.style.opacity = '1'
    morphIcon.style.filter = 'none'
    morphIcon.style.transform = 'scale(1)'
    if (morphBadge && unreadAnnouncementsCount.value > 0) {
      morphBadge.style.opacity = '1'
      morphBadge.style.transform = 'scale(1)'
    }

    // 2. 解除原按鈕隱藏（無 transition 即時就地顯示，與形變物件 100% 重合）
    if (triggerBtn) {
      triggerBtn.style.setProperty('transition', 'none', 'important')
      triggerBtn.style.setProperty('opacity', '1', 'important')
      triggerBtn.style.setProperty('visibility', 'visible', 'important')
      triggerBtn.classList.remove('is-hidden-for-morph')
      triggerBtn.blur()
      void triggerBtn.offsetHeight
      requestAnimationFrame(() => {
        if (triggerBtn) {
          triggerBtn.style.removeProperty('opacity')
          triggerBtn.style.removeProperty('visibility')
          triggerBtn.style.removeProperty('transition')
        }
      })
    }

    // 3. 避免穿幫：模擬形變的物件在收合後延遲一段時間再消失！
    // 期間將 overlay 設為非交互 (pointer-events: none)，使原按鈕立即具備點擊與 hover 能力
    overlay.style.pointerEvents = 'none'
    menu.style.pointerEvents = 'none'

    // 延遲 140ms 後再安全移除模擬形變節點，給予重疊繪製充足時間，徹底消除穿幫閃爍
    cleanupTimer = setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
      cleanupTimer = null
      if (onComplete) onComplete()
    }, 140)
  }

  session.rafId = requestAnimationFrame(stepClose)
}

function openMorphModal() {
  const triggerBtn = triggerBtnRef.value
  if (!triggerBtn) return

  // 關閉泡泡提示
  handleDismissBubble()

  // 若前次收合延遲計時器仍在運行，立即清除並清理舊節點
  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
    cleanupTimer = null
    const oldOverlays = document.querySelectorAll('.announcement-morph-overlay')
    oldOverlays.forEach(el => el.parentNode?.removeChild(el))
  }

  if (activeMorphSession) {
    closeMorphModal(() => {
      openMorphModal()
    })
    return
  }

  const rect = triggerBtn.getBoundingClientRect()
  const p0 = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }

  // 立即隱藏原按鈕本體，杜絕任何 transition 緩慢消失導致的展開殘影
  triggerBtn.classList.add('is-hidden-for-morph')
  triggerBtn.style.setProperty('opacity', '0', 'important')
  triggerBtn.style.setProperty('visibility', 'hidden', 'important')
  triggerBtn.style.setProperty('transition', 'none', 'important')
  void triggerBtn.offsetHeight // 強制同幀同步生效！

  // 建立全域 Fixed Overlay
  const overlay = document.createElement('div')
  overlay.className = 'announcement-morph-overlay is-active'

  const menu = document.createElement('div')
  menu.className = 'global-announcement-modal'
  menu.style.width = '36px'
  menu.style.height = '36px'
  menu.style.left = `${rect.left}px`
  menu.style.top = `${rect.top}px`
  menu.style.borderRadius = '18px'

  // 變形過渡圖標 (📢)
  const morphIcon = document.createElement('span')
  morphIcon.className = 'morph-icon'
  morphIcon.innerHTML = `
    <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  `

  // 變形過渡紅點徽章 (若有未讀公告)
  let morphBadge: HTMLElement | null = null
  if (unreadAnnouncementsCount.value > 0) {
    morphBadge = document.createElement('span')
    morphBadge.className = `unread-badge morph-badge ${unreadAnnouncementsCount.value > 9 ? 'badge-pill' : ''}`
    morphBadge.textContent = unreadAnnouncementsCount.value > 99 ? '99+' : String(unreadAnnouncementsCount.value)
  }

  // 公告面板內部內容容器
  const menuContent = document.createElement('div')
  menuContent.className = 'morph-announcement-content'

  // 動態渲染公告列表 HTML
  const itemsHtml = sortedAnnouncements.value.length === 0
    ? `<div class="morph-empty-state morph-stagger-item">目前尚無更新公告</div>`
    : sortedAnnouncements.value.map((item, idx) => {
        const tagBadge = item.tag ? `<span class="ann-badge ${getTagClass(item.tag)}">${item.tag}</span>` : ''
        const pinBadge = item.isPinned ? `<span class="ann-badge tag-pinned">📌 置頂</span>` : ''
        const bodyHtml = renderMarkdown(item.content)
        return `
          <div class="morph-announcement-card morph-stagger-item" data-ann-id="${item.id}" style="animation-delay: ${idx * 14}ms;">
            <div class="ann-card-header">
              <div class="ann-badges-row">${pinBadge}${tagBadge}</div>
              <span class="ann-time">${formatDate(item.createdAt)}</span>
            </div>
            <h4 class="ann-title">${item.title}</h4>
            <div class="ann-body markdown-content">${bodyHtml}</div>
          </div>
        `
      }).join('')

  menuContent.innerHTML = `
    <div class="morph-panel-header morph-stagger-item">
      <div class="header-left">
        <span class="header-icon">
          <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </span>
        <h3 class="header-title">課程更新與公告</h3>
        ${unreadAnnouncementsCount.value > 0 ? `<span class="unread-chip">${unreadAnnouncementsCount.value} 未讀</span>` : ''}
      </div>
      <div class="header-actions">
        ${unreadAnnouncementsCount.value > 0 ? `<button type="button" class="btn-mark-all" id="btnMarkAllRead">全部已讀</button>` : ''}
        <button type="button" class="btn-close-panel" id="btnCloseMorphModal" title="關閉公告">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    <div class="morph-scroll-container custom-scrollbar">
      ${itemsHtml}
    </div>
  `

  menu.appendChild(morphIcon)
  if (morphBadge) {
    menu.appendChild(morphBadge)
  }
  menu.appendChild(menuContent)
  overlay.appendChild(menu)
  document.body.appendChild(overlay)

  // 測量實際動態內容高度（最大高度約束 480px）
  const expandedWidth = Math.min(420, window.innerWidth - 24)
  const MAX_MODAL_HEIGHT = Math.min(500, window.innerHeight - 80)

  const measureWrap = document.createElement('div')
  measureWrap.className = 'global-announcement-modal'
  measureWrap.style.cssText = `position:fixed; left:-9999px; top:-9999px; width:${expandedWidth}px; max-height:${MAX_MODAL_HEIGHT}px; height:auto; visibility:hidden; opacity:0; pointer-events:none;`
  const cloneMeasure = menuContent.cloneNode(true) as HTMLElement
  cloneMeasure.style.position = 'static'
  cloneMeasure.style.opacity = '1'
  cloneMeasure.style.pointerEvents = 'none'
  measureWrap.appendChild(cloneMeasure)
  document.body.appendChild(measureWrap)
  const measuredHeight = Math.ceil(measureWrap.getBoundingClientRect().height)
  document.body.removeChild(measureWrap)

  const expandedHeight = Math.min(MAX_MODAL_HEIGHT, Math.max(160, measuredHeight))

  // 計算展開目標位置（貼齊按鈕右側下方）
  let targetTop = rect.bottom + 8
  let targetLeft = rect.right - expandedWidth

  if (targetTop + expandedHeight > window.innerHeight - 12) {
    targetTop = window.innerHeight - expandedHeight - 12
  }
  if (targetTop < 12) {
    targetTop = 12
  }
  if (targetLeft < 12) {
    targetLeft = 12
  }

  const targetBounds = { targetLeft, targetTop, expandedWidth, expandedHeight }

  // 目標展開中心 P2：偏向右上方以保持起點空間連貫感
  const p2 = {
    x: targetLeft + expandedWidth * 0.82,
    y: targetTop + Math.min(36, expandedHeight * 0.18),
  }

  // 拋物線控制點 P1（自然向上微弧 18px 升力）
  const p1 = {
    x: (p0.x + p2.x) / 2 + 2,
    y: Math.min(p0.y, p2.y) - 18,
  }

  const finalCenter = {
    x: targetLeft + expandedWidth / 2,
    y: targetTop + expandedHeight / 2,
  }

  // 隱藏原按鈕，無縫轉交由全域 overlay 接管
  triggerBtn.classList.add('is-hidden-for-morph')

  const session: MorphSession = {
    overlay,
    menu,
    morphIcon,
    morphBadge,
    triggerBtn,
    p0,
    p1,
    p2,
    finalCenter,
    targetBounds,
    rafId: null,
  }
  activeMorphSession = session
  isModalOpen.value = true

  // ── CONTINUOUS OVERLAP MORPH ANIMATION (0 - 480ms) ──
  // 0–70ms: 按鈕縮至 20px 圓點，圖標溶解
  // 30–260ms: 圓點沿二次貝茲曲線拋物飛行 (歷時 230ms)
  // 90–350ms: 空中重疊展開 (Continuous Overlap)
  // 290–420ms: 內部內容交錯浮現 (Staggered Fade/Blur)
  // 350–480ms: 壓克力微慣性歸位 (scale 1 -> 1.010 -> 1)
  const openStart = performance.now()
  let contentTriggered = false

  function stepOpen(now: number) {
    if (activeMorphSession !== session) return

    const elapsed = now - openStart

    // 1. 原圖標與紅點徽章溶解 (0 - 70ms)
    if (elapsed <= 70) {
      const ip = easeStandard(elapsed / 70)
      morphIcon.style.opacity = (1 - ip).toFixed(2)
      morphIcon.style.filter = `blur(${(4 * ip).toFixed(1)}px)`
      morphIcon.style.transform = `scale(${(1 - 0.3 * ip).toFixed(3)})`
      if (morphBadge) {
        morphBadge.style.opacity = (1 - ip).toFixed(2)
        morphBadge.style.transform = `scale(${(1 - 0.4 * ip).toFixed(3)})`
      }
    } else {
      morphIcon.style.opacity = '0'
      morphIcon.style.filter = 'blur(4px)'
      if (morphBadge) {
        morphBadge.style.opacity = '0'
      }
    }

    // 2. 飛行位置 (30 - 260ms, 歷時 230ms)
    let flightPt: { x: number; y: number }
    if (elapsed < 30) {
      flightPt = p0
    } else if (elapsed <= 260) {
      const fp = (elapsed - 30) / 230
      const fEase = easeStandard(fp)
      flightPt = getQuadraticBezierPoint(p0, p1, p2, fEase)
    } else {
      flightPt = p2
    }

    // 3. 幾何尺寸與邊界半徑展開
    let curW: number, curH: number, curCenterX: number, curCenterY: number, curRadius: number

    if (elapsed < 80) {
      // 初始按鈕縮減 (36px -> 20px)
      const sp = easeStandard(elapsed / 80)
      const shrinkSize = 36 - 16 * sp
      curW = shrinkSize
      curH = shrinkSize
      curCenterX = flightPt.x
      curCenterY = flightPt.y
      // 圓角隨高寬半徑過渡 (18px -> 10px)
      curRadius = shrinkSize / 2
    } else if (elapsed < 90) {
      // 20px 圓點準備空中展開：半徑為高與寬的一半 (10px)
      curW = 20
      curH = 20
      curCenterX = flightPt.x
      curCenterY = flightPt.y
      curRadius = 10
    } else if (elapsed < 350) {
      // 空中重疊展開 (90 - 350ms, 歷時 260ms)
      // 圓角從高與寬的一半 (10px) 平滑過渡到終點的大小 (17px)
      const ep = (elapsed - 90) / 260
      const eEase = easeStandard(ep)

      curW = 20 + (expandedWidth - 20) * eEase
      curH = 20 + (expandedHeight - 20) * eEase
      curRadius = 10 + 7 * eEase

      // 中心點從飛行點平滑過渡至 finalCenter
      curCenterX = flightPt.x + (finalCenter.x - p2.x) * eEase
      curCenterY = flightPt.y + (finalCenter.y - p2.y) * eEase
    } else {
      // 展開鎖定於目標邊界 (17px)
      curW = expandedWidth
      curH = expandedHeight
      curCenterX = finalCenter.x
      curCenterY = finalCenter.y
      curRadius = 17
    }

    menu.style.width = `${curW.toFixed(1)}px`
    menu.style.height = `${curH.toFixed(1)}px`
    menu.style.left = `${(curCenterX - curW / 2).toFixed(1)}px`
    menu.style.top = `${(curCenterY - curH / 2).toFixed(1)}px`
    menu.style.borderRadius = `${curRadius.toFixed(1)}px`

    // 空中重疊展開時切換為浮動面板磨砂質感
    if (elapsed >= 90 && !menu.classList.contains('is-expanded')) {
      menu.classList.add('is-expanded')
    }

    // 4. 於 ~290ms 觸發內部內容交錯浮現 (Staggered Fade/Blur)
    if (elapsed >= 290 && !contentTriggered) {
      contentTriggered = true
      menu.classList.add('is-content-visible')
    }

    // 5. 壓克力微慣性歸位 (350 - 480ms, 振幅 0.010)
    if (elapsed >= 350 && elapsed < 480) {
      const sp = (elapsed - 350) / 130
      const bump = Math.sin(sp * Math.PI) * Math.max(0, 1 - 0.25 * sp)
      const settleScale = 1 + 0.010 * bump
      menu.style.transform = `scale(${settleScale.toFixed(4)})`
    } else if (elapsed >= 480) {
      menu.style.transform = 'scale(1)'
      menu.classList.add('is-settled')
      session.rafId = null
      return
    } else {
      menu.style.transform = 'scale(1)'
    }

    session.rafId = requestAnimationFrame(stepOpen)
  }

  session.rafId = requestAnimationFrame(stepOpen)

  // 點擊外部關閉
  overlay.addEventListener('pointerdown', (e) => {
    if (!menu.contains(e.target as Node)) {
      e.stopPropagation()
      closeMorphModal()
    }
  })

  // 內部按鈕事件委託
  const btnClose = menu.querySelector('#btnCloseMorphModal')
  if (btnClose) {
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation()
      closeMorphModal()
    })
  }

  const btnMarkAll = menu.querySelector('#btnMarkAllRead')
  if (btnMarkAll) {
    btnMarkAll.addEventListener('click', (e) => {
      e.stopPropagation()
      handleMarkAllAsRead()
      // 標記全部已讀後關閉
      closeMorphModal()
    })
  }

  // 點擊單個公告卡片標記已讀
  const cards = menu.querySelectorAll('.morph-announcement-card')
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const annId = (card as HTMLElement).dataset.annId
      if (annId) {
        markAnnouncementAsRead(annId, props.studentId || '')
      }
    })
  })
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && activeMorphSession) {
    closeMorphModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  initStudentReadState(props.studentId || '')
  fetchAnnouncementsFromDb()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
    cleanupTimer = null
  }
  if (activeMorphSession) {
    if (activeMorphSession.rafId) cancelAnimationFrame(activeMorphSession.rafId)
    if (activeMorphSession.overlay && activeMorphSession.overlay.parentNode) {
      activeMorphSession.overlay.parentNode.removeChild(activeMorphSession.overlay)
    }
    activeMorphSession = null
  }
})
</script>

<template>
  <div class="announcement-btn-container">
    <!-- 原始 36px 圓形按鈕 -->
    <button
      ref="triggerBtnRef"
      class="announcement-trigger-btn"
      type="button"
      title="查看課程公告"
      @click="openMorphModal"
    >
      <span class="btn-icon">
        <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </span>
      <!-- 紅點與未讀數字徽章 -->
      <span
        v-if="unreadAnnouncementsCount > 0"
        class="unread-badge"
        :class="{ 'badge-pill': unreadAnnouncementsCount > 9 }"
      >
        {{ unreadAnnouncementsCount > 99 ? '99+' : unreadAnnouncementsCount }}
      </span>
    </button>

    <!-- 未讀公告提示泡泡 (Bubble Tooltip) -->
    <transition name="bubble-pop">
      <div
        v-if="showBubble"
        class="announcement-bubble"
        role="alert"
        @click="openMorphModal"
      >
        <span class="bubble-arrow" aria-hidden="true"></span>
        <div class="bubble-content">
          <span class="bubble-icon">📢</span>
          <span class="bubble-text">有新的課程公告，點此查看！</span>
        </div>
        <button
          type="button"
          class="bubble-close-btn"
          title="關閉提示"
          @click.stop="handleDismissBubble"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </transition>
  </div>
</template>

<style>
/* ─────────────────────────────────────────────────────────────
   GLOBAL OPTION MORPH MENU (Button → Dot → Surface)
   ───────────────────────────────────────────────────────────── */
.announcement-morph-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
  background: transparent;
}

.announcement-morph-overlay.is-active {
  pointer-events: auto;
}

:root {
  --morph-ease: cubic-bezier(.4, 0, .2, 1);
}

.global-announcement-modal {
  position: fixed;
  box-sizing: border-box;
  z-index: 10001;
  overflow: hidden;
  pointer-events: auto;
  background: var(--white, #ffffff);
  border: 1px solid var(--color-border-default, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transform-origin: center center;
  will-change: width, height, top, left, border-radius, transform;
  transition: box-shadow 0.22s var(--morph-ease), background 0.22s var(--morph-ease), border-color 0.22s var(--morph-ease);
}

.global-announcement-modal.is-expanded {
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.28);
  box-shadow: 0 12px 36px -4px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
}

.global-announcement-modal.is-settled {
  overflow: hidden;
}

/* 變形飛行中的圖標 (📢) - 由 JS rAF 逐幀精準控制，關閉 CSS transition 避免競爭造成閃爍與卡頓 */
.global-announcement-modal .morph-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary, #475569);
  pointer-events: none;
  opacity: 1;
  filter: blur(0);
  transform: scale(1);
  transition: none;
}

/* 變形飛行與歸位中的未讀徽章 - 由 JS rAF 同步浮現/消隱 */
.global-announcement-modal .morph-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  pointer-events: none;
  transition: none;
}

/* 面板內容容器 - 延長至 140ms 平滑漸顯漸隱 */
.global-announcement-modal .morph-announcement-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.14s var(--morph-ease);
}

.global-announcement-modal.is-content-visible .morph-announcement-content {
  opacity: 1;
  pointer-events: auto;
}

/* 面板頂部 Header */
.morph-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  background: rgba(248, 250, 252, 0.8);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}

.morph-panel-header .header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.morph-panel-header .header-icon {
  color: #2563eb;
  display: flex;
  align-items: center;
}

.morph-panel-header .header-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.morph-panel-header .unread-chip {
  padding: 2px 7px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  border: 1px solid #fecaca;
}

.morph-panel-header .header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.morph-panel-header .btn-mark-all {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: background 0.15s ease, color 0.15s ease;
}

.morph-panel-header .btn-mark-all:hover {
  background: #eff6ff;
  color: #1d4ed8;
}

.morph-panel-header .btn-close-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.morph-panel-header .btn-close-panel:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #0f172a;
}

/* 內部可滾動列表 */
.morph-scroll-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 滾動條樣式 */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.4);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.6);
}

/* 公告卡片 */
.morph-announcement-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  cursor: pointer;
}

.morph-announcement-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
}

.ann-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ann-badges-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ann-badge {
  display: inline-block;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
}

.tag-pinned {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

.tag-important {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.tag-update {
  background: #e0f2fe;
  color: #0284c7;
  border: 1px solid #bae6fd;
}

.tag-activity {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.tag-default {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.ann-time {
  font-size: 11px;
  color: #94a3b8;
}

.ann-title {
  margin: 0 0 6px 0;
  font-size: 13.5px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.4;
}

.ann-body {
  font-size: 12px;
  color: #475569;
  line-height: 1.55;
  max-height: 160px;
  overflow-y: auto;
}

.ann-body p {
  margin: 0 0 6px 0;
}
.ann-body p:last-child {
  margin-bottom: 0;
}

.ann-body ul, .ann-body ol {
  margin: 4px 0 6px 16px;
  padding: 0;
}

.ann-body code {
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 11px;
  color: #0f172a;
}

.morph-empty-state {
  text-align: center;
  padding: 32px 16px;
  color: #94a3b8;
  font-size: 13px;
}

/* Staggered Reveal Animation（5px 微模糊過渡實現融球形變） */
.global-announcement-modal .morph-stagger-item {
  opacity: 0;
  filter: blur(5px);
  transform: translateY(5px);
  transition: opacity 0.18s var(--morph-ease),
              filter 0.18s var(--morph-ease),
              transform 0.18s var(--morph-ease);
}

.global-announcement-modal.is-content-visible .morph-stagger-item {
  opacity: 1;
  filter: blur(0px);
  transform: translateY(0);
}

/* Stagger Delays (14ms intervals) */
.global-announcement-modal.is-content-visible .morph-stagger-item:nth-child(1) { transition-delay: 0ms; }
.global-announcement-modal.is-content-visible .morph-stagger-item:nth-child(2) { transition-delay: 14ms; }
.global-announcement-modal.is-content-visible .morph-stagger-item:nth-child(3) { transition-delay: 28ms; }
.global-announcement-modal.is-content-visible .morph-stagger-item:nth-child(4) { transition-delay: 42ms; }
.global-announcement-modal.is-content-visible .morph-stagger-item:nth-child(5) { transition-delay: 56ms; }

/* Closing: Reverse Stagger + Soft Blur (5px) 融球回縮 (隱藏時間延長至約 140ms，徹底杜絕閃爍) */
.global-announcement-modal.is-items-collapsing .morph-stagger-item {
  opacity: 0 !important;
  filter: blur(5px) !important;
  transform: translateY(4px) !important;
  transition: opacity 0.11s var(--morph-ease),
              filter 0.11s var(--morph-ease),
              transform 0.11s var(--morph-ease) !important;
}

.global-announcement-modal.is-items-collapsing .morph-stagger-item:nth-child(5) { transition-delay: 0ms !important; }
.global-announcement-modal.is-items-collapsing .morph-stagger-item:nth-child(4) { transition-delay: 8ms !important; }
.global-announcement-modal.is-items-collapsing .morph-stagger-item:nth-child(3) { transition-delay: 16ms !important; }
.global-announcement-modal.is-items-collapsing .morph-stagger-item:nth-child(2) { transition-delay: 24ms !important; }
.global-announcement-modal.is-items-collapsing .morph-stagger-item:nth-child(1) { transition-delay: 32ms !important; }

/* 原按鈕隱藏（零跳動銜接：即時隱藏無延遲過渡殘影） */
.is-hidden-for-morph,
.announcement-trigger-btn.is-hidden-for-morph {
  opacity: 0 !important;
  visibility: hidden !important;
  transition: none !important;
  transition-property: none !important;
  pointer-events: none !important;
}
</style>

<style scoped>
/* ─────────────────────────────────────────────────────────────
   按鈕與泡泡提示組件內部樣式
   ───────────────────────────────────────────────────────────── */
.announcement-btn-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 原始 36px 圓形按鈕：維持原本的白色背景、圓角邊框與陰影，不縮放避免穿幫 */
.announcement-trigger-btn {
  position: relative;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border-default, #e2e8f0);
  background: var(--white, #ffffff);
  color: var(--color-text-secondary, #475569);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  padding: 0;
  box-sizing: border-box;
  outline: none;
  transform: none !important;
  transition: background 0.18s var(--morph-ease),
              color 0.18s var(--morph-ease),
              border-color 0.18s var(--morph-ease),
              box-shadow 0.18s var(--morph-ease) !important;
}

.announcement-trigger-btn:hover {
  background: var(--slate-50, #f8fafc);
  color: #2563eb;
  border-color: #93c5fd;
  transform: none !important;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.1);
}

.announcement-trigger-btn:active {
  transform: scale(0.96) !important;
}

/* 圖標本身背景透明，無額外底色 */
.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
}

/* 紅點與未讀數字徽章 */
.unread-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 17px;
  height: 17px;
  padding: 0 3px;
  border-radius: 9px;
  background: #ef4444;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px #ffffff;
  pointer-events: none;
  animation: badge-pulse 2s infinite ease-in-out;
}

.unread-badge.badge-pill {
  padding: 0 5px;
}

@keyframes badge-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.12);
  }
}

/* 提示泡泡 (Bubble) */
.announcement-bubble {
  position: absolute;
  top: calc(100% + 9px);
  right: 0;
  white-space: nowrap;
  background: #1e293b;
  color: #ffffff;
  border-radius: 8px;
  padding: 7px 11px 7px 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 24px -2px rgba(15, 23, 42, 0.25), 0 2px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  cursor: pointer;
  animation: bubble-float 3s infinite ease-in-out;
}

.bubble-arrow {
  position: absolute;
  top: -5px;
  right: 13px;
  width: 10px;
  height: 10px;
  background: #1e293b;
  transform: rotate(45deg);
}

.bubble-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bubble-icon {
  font-size: 13px;
}

.bubble-text {
  font-size: 12px;
  font-weight: 600;
  color: #f8fafc;
  letter-spacing: 0.2px;
}

.bubble-close-btn {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background 0.15s ease;
}

.bubble-close-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
}

@keyframes bubble-float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

/* 泡泡顯示與隱藏過渡 */
.bubble-pop-enter-active,
.bubble-pop-leave-active {
  transition: opacity 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.bubble-pop-enter-from,
.bubble-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.9);
}
</style>
