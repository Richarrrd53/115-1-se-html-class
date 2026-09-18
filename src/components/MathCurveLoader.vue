<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    label?: string
    subtext?: string
    color?: string
  }>(),
  {
    size: 'md',
    label: '',
    subtext: '',
    color: 'var(--color-brand-primary, #2563eb)',
  },
)

const groupRef = ref<SVGGElement | null>(null)
const pathRef = ref<SVGPathElement | null>(null)
const suckedRef = ref<SVGGElement | null>(null)

const SVG_NS = 'http://www.w3.org/2000/svg'

const config = {
  name: 'Rose Curve',
  rotate: true,
  particleCount: 72,
  trailSpan: 0.32,
  durationMs: 5400,
  rotationDurationMs: 28000,
  pulseDurationMs: 4600,
  strokeWidth: 4.5,
  roseA: 9.2,
  roseABoost: 0.6,
  roseBreathBase: 0.72,
  roseBreathBoost: 0.28,
  roseK: 5,
  roseScale: 3.25,
  point(progress: number, detailScale: number) {
    const t = progress * Math.PI * 2
    const a = this.roseA + detailScale * this.roseABoost
    const k = Math.round(this.roseK)
    const r = a * (this.roseBreathBase + detailScale * this.roseBreathBoost) * Math.cos(k * t)
    return {
      x: 50 + Math.cos(t) * r * this.roseScale,
      y: 50 + Math.sin(t) * r * this.roseScale,
    }
  },
}

const assetColors = [
  '#38bdf8', // sky
  '#60a5fa', // blue
  '#818cf8', // indigo
  '#34d399', // emerald
  '#ffffff', // pure white
]

interface SuckedAsset {
  el: SVGCircleElement
  radius: number
  angle: number
  speed: number
}

let animId: number | null = null
let particles: SVGCircleElement[] = []
let suckedAssets: SuckedAsset[] = []

function normalizeProgress(p: number) {
  return ((p % 1) + 1) % 1
}

function getDetailScale(time: number) {
  const pulseProgress = (time % config.pulseDurationMs) / config.pulseDurationMs
  const pulseAngle = pulseProgress * Math.PI * 2
  return 0.52 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.48
}

function getRotation(time: number) {
  if (!config.rotate) return 0
  return -((time % config.rotationDurationMs) / config.rotationDurationMs) * 360
}

function buildPath(detailScale: number, steps = 380) {
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const pt = config.point(i / steps, detailScale)
    d += `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)} `
  }
  return d
}

function getParticle(index: number, progress: number, detailScale: number) {
  const tailOffset = index / (config.particleCount - 1)
  const pt = config.point(normalizeProgress(progress - tailOffset * config.trailSpan), detailScale)
  const fade = Math.pow(1 - tailOffset, 0.56)
  return {
    x: pt.x,
    y: pt.y,
    radius: 0.9 + fade * 2.6,
    opacity: 0.04 + fade * 0.96,
  }
}

function startAnimation() {
  if (!groupRef.value || !pathRef.value) return

  // Clear previous
  particles.forEach((c) => c.remove())
  particles = []
  if (suckedRef.value) suckedRef.value.innerHTML = ''
  suckedAssets = []

  pathRef.value.setAttribute('stroke-width', String(config.strokeWidth))

  for (let i = 0; i < config.particleCount; i++) {
    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('fill', 'currentColor')
    groupRef.value.appendChild(circle)
    particles.push(circle)
  }

  const startedAt = performance.now()

  function render(now: number) {
    const time = now - startedAt
    const progress = (time % config.durationMs) / config.durationMs
    const detailScale = getDetailScale(time)
    const rotation = getRotation(time)
    const pathD = buildPath(detailScale)

    if (groupRef.value) {
      groupRef.value.setAttribute('transform', `rotate(${rotation} 50 50)`)
    }
    if (pathRef.value) {
      pathRef.value.setAttribute('d', pathD)
    }

    particles.forEach((node, index) => {
      const p = getParticle(index, progress, detailScale)
      node.setAttribute('cx', p.x.toFixed(2))
      node.setAttribute('cy', p.y.toFixed(2))
      node.setAttribute('r', p.radius.toFixed(2))
      node.setAttribute('opacity', p.opacity.toFixed(3))
    })

    // Sucked particles
    if (suckedRef.value) {
      if (Math.random() < 0.04 && suckedAssets.length < 10) {
        const angle = Math.random() * Math.PI * 2
        const startRadius = 75 + Math.random() * 20
        const speed = 0.5 + Math.random() * 0.5
        const c = assetColors[Math.floor(Math.random() * assetColors.length)]
        const r = 1.0 + Math.random() * 1.5

        const el = document.createElementNS(SVG_NS, 'circle')
        el.setAttribute('r', String(r))
        el.setAttribute('fill', c)
        el.setAttribute('opacity', '0')
        suckedRef.value.appendChild(el)

        suckedAssets.push({ el, radius: startRadius, angle, speed })
      }

      for (let i = suckedAssets.length - 1; i >= 0; i--) {
        const asset = suckedAssets[i]
        asset.radius -= asset.speed

        const x = 50 + Math.cos(asset.angle) * asset.radius
        const y = 50 + Math.sin(asset.angle) * asset.radius

        let opacity = 0
        if (asset.radius > 70) {
          opacity = (95 - asset.radius) / 25
        } else if (asset.radius > 15) {
          opacity = 0.85
        } else {
          opacity = (asset.radius / 15) * 0.85
        }
        opacity = Math.max(0, Math.min(0.85, opacity))

        asset.el.setAttribute('cx', x.toFixed(2))
        asset.el.setAttribute('cy', y.toFixed(2))
        asset.el.setAttribute('opacity', opacity.toFixed(3))

        if (asset.radius <= 2) {
          asset.el.remove()
          suckedAssets.splice(i, 1)
        }
      }
    }

    animId = requestAnimationFrame(render)
  }

  animId = requestAnimationFrame(render)
}

function stopAnimation() {
  if (animId) {
    cancelAnimationFrame(animId)
    animId = null
  }
}

onMounted(() => {
  startAnimation()
})

onUnmounted(() => {
  stopAnimation()
})
</script>

<template>
  <div class="math-curve-loader-container" :class="[`size-${size}`]" :style="{ color }">
    <div class="math-curve-svg-box">
      <svg class="math-curve-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <g ref="groupRef" class="math-loader-group">
          <path ref="pathRef" class="math-loader-path" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" opacity="0.12" />
        </g>
        <g ref="suckedRef" class="math-loader-sucked" />
      </svg>
    </div>
    <div v-if="label || subtext" class="math-curve-meta">
      <div v-if="label" class="math-curve-label">{{ label }}</div>
      <div v-if="subtext" class="math-curve-subtext">{{ subtext }}</div>
    </div>
  </div>
</template>

<style scoped>
.math-curve-loader-container {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  user-select: none;
}

.math-curve-svg-box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.size-sm .math-curve-svg-box {
  width: 48px;
  height: 48px;
}

.size-md .math-curve-svg-box {
  width: 86px;
  height: 86px;
}

.size-lg .math-curve-svg-box {
  width: 128px;
  height: 128px;
}

.math-curve-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 4px 12px rgba(37, 99, 235, 0.18));
}

.math-curve-meta {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.math-curve-label {
  font-size: var(--font-size-base, 0.95rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary, #0f172a);
  letter-spacing: -0.01em;
}

.math-curve-subtext {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-tertiary, #64748b);
  max-width: 280px;
}
</style>
