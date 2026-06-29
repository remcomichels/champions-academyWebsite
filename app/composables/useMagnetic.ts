import type { Ref } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// useMagnetic
//
// Gentle, continuous sine-wave float for decorative elements — each drifts on
// independent X/Y waves (amplitude + speed configurable per element via data
// attributes). Rides the shared rAF. Skipped under reduced motion.
//
// Note: despite the name this is a float, NOT a cursor-magnetic effect.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MagneticOptions {
  /** CSS selector for elements to float. Default: '.magnetic'. */
  selector?: string
  /**
   * Base oscillation speed (radians per millisecond) used when an element has
   * no per-element data-float-speed-x / data-float-speed-y override. Each
   * element's speed is jittered ±15% so a group never floats in lockstep.
   * Default: 0.001.
   */
  speed?: number
}

interface UseMagneticReturn {
  /** Scan for matching elements (within `root` if given) and start floating them. */
  initMagnetic: () => void
  /** Stop the loop, drop the resize listener, and clear the inline transforms we set. */
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-element state
// ─────────────────────────────────────────────────────────────────────────────

interface FloatState {
  el: HTMLElement
  ampX: number
  ampY: number
  speedX: number
  speedY: number
  start: number | null
  baseTransform: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (pure — no instance state)
// ─────────────────────────────────────────────────────────────────────────────

function randInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// Amplitude in px: an explicit data-float-range-* wins, else half the element's own size.
function getAmplitude(el: HTMLElement, key: 'floatRangeX' | 'floatRangeY'): number {
  const value = el.dataset[key]
  const parsed = value ? Number.parseFloat(value) : Number.NaN
  if (Number.isFinite(parsed)) return parsed

  const rect = el.getBoundingClientRect()
  const base = key === 'floatRangeX' ? rect.width : rect.height
  return base / 2
}

// Speed in rad/ms: an explicit data-float-speed-* wins, else the composable default.
function getSpeed(el: HTMLElement, key: 'floatSpeedX' | 'floatSpeedY', fallback: number): number {
  const value = el.dataset[key]
  const parsed = value ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gentle, continuous sine-wave float for decorative elements. Each element drifts
 * on independent X/Y sine waves — amplitude and speed configurable per element via
 * data attributes — all driven by the app-wide shared rAF (see useRaf).
 *
 * @param root  Optional ref to scope the query to one component instance. Omit it
 *              to float every matching element on the page (e.g. from a layout).
 */
export function useMagnetic(
  root?: Ref<HTMLElement | null>,
  options: MagneticOptions = {},
): UseMagneticReturn {
  const {
    selector = '.magnetic',
    speed = 0.001,
  } = options

  const { add, remove } = useRaf()
  const { reduced } = useReducedMotion()

  const instances = new Map<HTMLElement, FloatState>()
  let running = false
  let onResize: (() => void) | null = null

  // ── Frame loop ──────────────────────────────────────────────────────────

  function tick(time: number): void {
    // Shared ticker time is in seconds; the float math is tuned in milliseconds.
    const ms = time * 1000
    let active = false

    instances.forEach((state, el) => {
      if (!el.isConnected) {
        instances.delete(el)
        return
      }

      if (state.start === null) state.start = ms

      const t = ms - state.start
      const x = Math.sin(t * state.speedX) * state.ampX
      const y = Math.sin(t * state.speedY) * state.ampY

      el.style.transform = state.baseTransform
        ? `${state.baseTransform} translate3d(${x}px, ${y}px, 0)`
        : `translate3d(${x}px, ${y}px, 0)`
      active = true
    })

    // Nothing left to animate — drop off the shared loop until the next init.
    if (!active) {
      running = false
      remove(tick)
    }
  }

  function startTick(): void {
    if (running) return
    running = true
    add(tick)
  }

  // ── Public API ──────────────────────────────────────────────────────────

  function initMagnetic(): void {
    // Respect users who asked for less motion — leave elements untouched.
    if (reduced.value) return

    const scope: ParentNode = root?.value ?? document

    scope.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (instances.has(el)) return

      const baseSpeedX = getSpeed(el, 'floatSpeedX', speed)
      const baseSpeedY = getSpeed(el, 'floatSpeedY', speed)
      const computedTransform = getComputedStyle(el).transform

      instances.set(el, {
        el,
        ampX: getAmplitude(el, 'floatRangeX'),
        ampY: getAmplitude(el, 'floatRangeY'),
        speedX: baseSpeedX * randInRange(0.85, 1.15),
        speedY: baseSpeedY * randInRange(0.85, 1.15),
        start: null,
        baseTransform: computedTransform !== 'none' ? computedTransform : '',
      })

      el.style.willChange = 'transform'
    })

    if (instances.size === 0) return

    // Re-measure size-derived amplitudes when the viewport changes.
    if (!onResize) {
      onResize = () => {
        instances.forEach((state) => {
          state.ampX = getAmplitude(state.el, 'floatRangeX')
          state.ampY = getAmplitude(state.el, 'floatRangeY')
        })
      }
      window.addEventListener('resize', onResize, { passive: true })
    }

    startTick()
  }

  function destroy(): void {
    running = false
    remove(tick)

    if (onResize) {
      window.removeEventListener('resize', onResize)
      onResize = null
    }

    // Clear the inline props we set so elements fall back to their CSS state.
    instances.forEach((state) => {
      state.el.style.transform = ''
      state.el.style.willChange = ''
    })
    instances.clear()
  }

  return { initMagnetic, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

This file lives in `composables/` so Nuxt 4 auto-imports it — no import
statement needed.

Each element drifts on two independent sine waves (X and Y). Motion is
purely decorative and is skipped entirely under prefers-reduced-motion.

<script setup lang="ts">
// Scope to one component so destroy() only touches this instance's elements.
const root = useTemplateRef<HTMLElement>('root')
const { initMagnetic, destroy } = useMagnetic(root, {
  // All options are optional — shown here for clarity
  selector: '.magnetic', // which elements to float
  speed:    0.001,       // base rad/ms when no per-element override is set
})

onMounted(() => initMagnetic())
onUnmounted(() => destroy())
</script>

<template>
  <div ref="root">
    <!-- Floats using size-derived amplitude (half its width/height) -->
    <span class="magnetic">drifts</span>

    <!-- Per-element overrides via data attributes -->
    <span
      class="magnetic"
      data-float-range-x="12"   // X amplitude in px
      data-float-range-y="6"    // Y amplitude in px
      data-float-speed-x="0.0015" // X speed in rad/ms
      data-float-speed-y="0.0008" // Y speed in rad/ms
    >drifts further</span>
  </div>
</template>

GLOBAL USE
  Call it once from a top-level component (e.g. layouts/default.vue) with no
  root ref to float every .magnetic element on the page:

    const { initMagnetic, destroy } = useMagnetic()
    onMounted(() => initMagnetic())
    onUnmounted(() => destroy())

NOTE
  The element's own CSS transform is preserved — the float is composed on top
  of it as a translate3d, and destroy() restores the original by clearing the
  inline transform.
──────────────────────────────────────────────────────────────────────
*/
