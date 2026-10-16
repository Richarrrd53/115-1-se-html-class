/**
 * StoryboardAI — 動態漸層遮罩系統 (Dynamic Gradient Mask System)
 * 適用於所有具備內部滾動特性的容器（main[class: content]、side-body 等）
 * 
 * 核心規範遵循：
 * 1. 純透明度漸層遮罩（Alpha Masking，mask-image / -webkit-mask-image）
 * 2. 純內容區域遮蔽（Content Isolation，隔離固定標頭）
 * 3. 無縫位移補償（Dynamic Shift Compensation）
 * 4. 1px 浮點容差與零開銷自動清除機制 (clearMask)
 * 5. 四態邊界邏輯與微溢出漸層起點演算法
 * 6. passive 滾動監聽 + rAF 排程 + ResizeObserver + MutationObserver
 * 7. SPA 生命週期契約與卸載清理 (detach)
 */

import type { Directive } from 'vue'

export interface DynamicMaskOptions {
  maskSize?: number
  direction?: 'vertical' | 'horizontal'
  scrollElement?: HTMLElement | string | null
  activeClass?: string
  fadeExponent?: number
}

export class DynamicMask {
  public element: HTMLElement
  public options: Required<Omit<DynamicMaskOptions, 'scrollElement'>> & {
    scrollElement: HTMLElement | string | null
  }
  public scrollElement: HTMLElement | null = null
  private rafId: number | null = null
  private resizeObserver: ResizeObserver | null = null
  private mutationObserver: MutationObserver | null = null
  private onScrollHandler: () => void

  constructor(element: HTMLElement, options: DynamicMaskOptions = {}) {
    this.element = element
    this.options = {
      maskSize: 36,
      direction: 'vertical',
      scrollElement: null,
      activeClass: 'has-dynamic-mask',
      fadeExponent: 1.0,
      ...options,
    }

    // 支援從 HTML data 屬性覆寫設定
    if (element.dataset) {
      if (element.dataset.maskSize) {
        const s = parseFloat(element.dataset.maskSize)
        if (!isNaN(s)) this.options.maskSize = s
      }
      if (element.dataset.maskDirection === 'vertical' || element.dataset.maskDirection === 'horizontal') {
        this.options.direction = element.dataset.maskDirection
      }
    }

    this.onScrollHandler = () => this.scheduleUpdate()
    this.scrollElement = this.resolveScrollElement()

    this.init()
  }

  private resolveScrollElement(): HTMLElement {
    if (this.options.scrollElement) {
      if (typeof this.options.scrollElement === 'string') {
        return (document.querySelector(this.options.scrollElement) as HTMLElement) || this.element
      }
      return this.options.scrollElement
    }
    return this.element
  }

  public init(): void {
    if (!this.element || !this.scrollElement) return

    this.element.classList.add(this.options.activeClass)

    // 1. 高幀率滾動監聽 (passive: true 防止滾動卡頓)
    this.scrollElement.addEventListener('scroll', this.onScrollHandler, { passive: true })

    // 2. 尺寸變化監聽 (ResizeObserver)
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.scheduleUpdate()
      })
      this.resizeObserver.observe(this.element)
      if (this.scrollElement !== this.element) {
        this.resizeObserver.observe(this.scrollElement)
      }
    }

    // 3. 內容變更監聽 (MutationObserver)
    if (typeof window !== 'undefined' && 'MutationObserver' in window) {
      this.mutationObserver = new MutationObserver(() => {
        this.scheduleUpdate()
      })
      this.mutationObserver.observe(this.scrollElement, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }

    // 初始立即運算
    this.update()
  }

  public scheduleUpdate(): void {
    if (this.rafId !== null) return
    if (typeof window === 'undefined') return

    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null
      this.update()
    })
  }

  public update(): void {
    if (!this.element || !this.scrollElement) return

    const isVertical = this.options.direction === 'vertical'
    const M = Math.max(1, this.options.maskSize)

    if (isVertical) {
      const scrollTop = this.scrollElement.scrollTop
      const scrollHeight = this.scrollElement.scrollHeight
      const clientHeight = this.scrollElement.clientHeight
      const maxScroll = Math.max(0, scrollHeight - clientHeight)

      // 臨界值與清除機制：若 maxScroll <= 1（無溢出或在 1px 渲染浮點公差內），立即移除遮罩
      if (maxScroll <= 1) {
        this.clearMask()
        return
      }

      const overflowTop = Math.max(0, scrollTop)
      const overflowBottom = Math.max(0, maxScroll - scrollTop)

      this.applyVerticalMask(overflowTop, overflowBottom, M)
    } else {
      // 水平方向
      const scrollLeft = this.scrollElement.scrollLeft
      const scrollWidth = this.scrollElement.scrollWidth
      const clientWidth = this.scrollElement.clientWidth
      const maxScrollX = Math.max(0, scrollWidth - clientWidth)

      if (maxScrollX <= 1) {
        this.clearMask()
        return
      }

      const overflowLeft = Math.max(0, scrollLeft)
      const overflowRight = Math.max(0, maxScrollX - scrollLeft)

      this.applyHorizontalMask(overflowLeft, overflowRight, M)
    }
  }

  private applyVerticalMask(overflowTop: number, overflowBottom: number, M: number): void {
    const el = this.element
    const hasTop = overflowTop > 0
    const hasBottom = overflowBottom > 0

    // 四態邊界邏輯 1: 完全無溢出
    if (!hasTop && !hasBottom) {
      this.clearMask()
      return
    }

    // 上方遮罩位移補償演算法
    let topStops = ''
    let topShift = M
    if (hasTop) {
      if (overflowTop < M) {
        const shift = M - overflowTop
        topShift = shift
        const startAlpha = (shift / M).toFixed(4)
        const hTop = Math.max(1, Math.round(overflowTop))
        topStops = `rgba(0, 0, 0, ${startAlpha}) 0px, black ${hTop}px`
      } else {
        topShift = 0
        topStops = `transparent 0px, black ${M}px`
      }
    } else {
      topStops = 'black 0px'
    }

    // 下方遮罩位移補償演算法
    let bottomStops = ''
    let bottomShift = M
    if (hasBottom) {
      if (overflowBottom < M) {
        const shift = M - overflowBottom
        bottomShift = shift
        const endAlpha = (shift / M).toFixed(4)
        const hBottom = Math.max(1, Math.round(overflowBottom))
        bottomStops = `black calc(100% - ${hBottom}px), rgba(0, 0, 0, ${endAlpha}) 100%`
      } else {
        bottomShift = 0
        bottomStops = `black calc(100% - ${M}px), transparent 100%`
      }
    } else {
      bottomStops = 'black 100%'
    }

    const maskVal = `linear-gradient(to bottom, ${topStops}, ${bottomStops})`
    el.style.setProperty('-webkit-mask-image', maskVal)
    el.style.setProperty('mask-image', maskVal)
    el.style.setProperty('--mask-top-shift', `${topShift}px`)
    el.style.setProperty('--mask-bottom-shift', `${bottomShift}px`)
  }

  private applyHorizontalMask(overflowLeft: number, overflowRight: number, M: number): void {
    const el = this.element
    const hasLeft = overflowLeft > 0
    const hasRight = overflowRight > 0

    if (!hasLeft && !hasRight) {
      this.clearMask()
      return
    }

    let leftStops = ''
    let leftShift = M
    if (hasLeft) {
      if (overflowLeft < M) {
        const shift = M - overflowLeft
        leftShift = shift
        const startAlpha = (shift / M).toFixed(4)
        const wLeft = Math.max(1, Math.round(overflowLeft))
        leftStops = `rgba(0, 0, 0, ${startAlpha}) 0px, black ${wLeft}px`
      } else {
        leftShift = 0
        leftStops = `transparent 0px, black ${M}px`
      }
    } else {
      leftStops = 'black 0px'
    }

    let rightStops = ''
    let rightShift = M
    if (hasRight) {
      if (overflowRight < M) {
        const shift = M - overflowRight
        rightShift = shift
        const endAlpha = (shift / M).toFixed(4)
        const wRight = Math.max(1, Math.round(overflowRight))
        rightStops = `black calc(100% - ${wRight}px), rgba(0, 0, 0, ${endAlpha}) 100%`
      } else {
        rightShift = 0
        rightStops = `black calc(100% - ${M}px), transparent 100%`
      }
    } else {
      rightStops = 'black 100%'
    }

    const maskVal = `linear-gradient(to right, ${leftStops}, ${rightStops})`
    el.style.setProperty('-webkit-mask-image', maskVal)
    el.style.setProperty('mask-image', maskVal)
    el.style.setProperty('--mask-left-shift', `${leftShift}px`)
    el.style.setProperty('--mask-right-shift', `${rightShift}px`)
  }

  public clearMask(): void {
    const el = this.element
    el.style.removeProperty('-webkit-mask-image')
    el.style.removeProperty('mask-image')
    el.style.removeProperty('--mask-top-shift')
    el.style.removeProperty('--mask-bottom-shift')
    el.style.removeProperty('--mask-left-shift')
    el.style.removeProperty('--mask-right-shift')
  }

  public destroy(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.scrollElement) {
      this.scrollElement.removeEventListener('scroll', this.onScrollHandler)
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }
    this.clearMask()
    if (this.element) {
      this.element.classList.remove(this.options.activeClass)
    }
    dynamicMaskInstances.delete(this.element)
  }
}

const dynamicMaskInstances = new Map<HTMLElement, DynamicMask>()

export const DynamicMaskSystem = {
  attach(element: HTMLElement | null, options: DynamicMaskOptions = {}): DynamicMask | null {
    if (!element) return null
    if (dynamicMaskInstances.has(element)) {
      const inst = dynamicMaskInstances.get(element)!
      inst.scheduleUpdate()
      return inst
    }
    const instance = new DynamicMask(element, options)
    dynamicMaskInstances.set(element, instance)
    return instance
  },

  detach(element: HTMLElement | null): void {
    if (!element) return
    const instance = dynamicMaskInstances.get(element)
    if (instance) {
      instance.destroy()
    }
  },

  get(element: HTMLElement | null): DynamicMask | null {
    if (!element) return null
    return dynamicMaskInstances.get(element) || null
  },

  update(element: HTMLElement | null): void {
    if (!element) return
    const inst = dynamicMaskInstances.get(element)
    if (inst) inst.scheduleUpdate()
  },

  updateAll(): void {
    dynamicMaskInstances.forEach((inst) => inst.scheduleUpdate())
  },

  initAuto(root: ParentNode = document): void {
    const selector = '[data-dynamic-mask], .dynamic-gradient-mask, .side-body, .content-body, .lesson-view-container'
    const targets = root.querySelectorAll<HTMLElement>(selector)
    targets.forEach((el) => {
      if (!dynamicMaskInstances.has(el)) {
        DynamicMaskSystem.attach(el)
      }
    })
  },

  refresh(root: ParentNode = document): void {
    const selector = '[data-dynamic-mask], .dynamic-gradient-mask, .side-body, .content-body, .lesson-view-container'
    const targets = root.querySelectorAll<HTMLElement>(selector)
    targets.forEach((el) => {
      let inst = dynamicMaskInstances.get(el)
      if (!inst) {
        inst = DynamicMaskSystem.attach(el) || undefined
      } else {
        inst.scheduleUpdate()
      }
    })
  },
}

// Vue 自定義指令 v-dynamic-mask
export const vDynamicMask: Directive<HTMLElement, DynamicMaskOptions | undefined> = {
  mounted(el, binding) {
    DynamicMaskSystem.attach(el, binding.value)
  },
  updated(el) {
    DynamicMaskSystem.update(el)
  },
  unmounted(el) {
    DynamicMaskSystem.detach(el)
  },
}

// 掛載至 window 全域命名空間以符合 StoryboardAI 架構規範
declare global {
  interface Window {
    DynamicMaskSystem?: typeof DynamicMaskSystem
  }
}

if (typeof window !== 'undefined') {
  window.DynamicMaskSystem = DynamicMaskSystem

  // 視窗 resize 統一排程觸發更新
  window.addEventListener(
    'resize',
    () => {
      DynamicMaskSystem.updateAll()
    },
    { passive: true },
  )

  // DOM 就緒自動掃描
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      DynamicMaskSystem.initAuto()
    })
  } else {
    setTimeout(() => {
      DynamicMaskSystem.initAuto()
    }, 10)
  }
}
