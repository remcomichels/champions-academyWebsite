import type { Ref } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// useScrollVelocity
//
// Reactive smoothed scroll velocity (signed px/s) plus a coarse direction — the
// primitive behind skew-on-scroll, velocity-reactive marquees and scroll-driven
// distortion. Rides the shared rAF; stays at 0 under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScrollVelocityOptions {
  /**
   * Time window (ms) over which scroll velocity is averaged. Larger = steadier
   * but laggier; smaller = twitchier.
   * Default: 120.
   */
  sampleWindow?: number
  /**
   * Idle time (ms) after the last scroll event before the velocity decays back
   * toward 0.
   * Default: 80.
   */
  timeout?: number
  /**
   * Per-frame easing factor (0–1) toward the freshly measured velocity. Lower
   * feels heavier/smoother.
   * Default: 0.15.
   */
  smoothing?: number
}

interface UseScrollVelocityReturn {
  /** Smoothed, signed scroll velocity in px/s. Positive = scrolling down, negative = up. Read-only output. */
  velocity: Ref<number>
  /** Coarse direction derived from `velocity`. Read-only output. */
  direction: Ref<'up' | 'down' | 'idle'>
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

/** Linear interpolation from `a` to `b` by factor `t` (0–1). */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reactive smoothed scroll velocity — the primitive behind skew-on-scroll,
 * velocity-reactive marquees, scroll-driven distortion, etc. It samples
 * window.scrollY over a short window (so it works with Lenis, which updates
 * native scroll), eases the result, and decays to 0 when scrolling stops.
 *
 * Driven by the shared rAF (see useRaf). Under reduced motion it stays at 0 so
 * consumers naturally fall back to their static state.
 */
export function useScrollVelocity(
  options: ScrollVelocityOptions = {},
): UseScrollVelocityReturn {
  const {
    sampleWindow = 120,
    timeout = 80,
    smoothing = 0.15,
  } = options

  const velocity = ref(0)
  const direction = ref<'up' | 'down' | 'idle'>('idle')

  const { add } = useRaf()
  const { reduced } = useReducedMotion()

  // Rolling buffer of recent scroll positions + the raw (un-smoothed) reading.
  const samples: { y: number; t: number }[] = []
  let rawVelocity = 0
  let lastScrollEventTime = 0

  // Record a position and drop samples older than the averaging window.
  function pushSample(y: number, t: number): void {
    samples.push({ y, t })
    const cutoff = t - sampleWindow
    while (samples.length > 0) {
      const first = samples[0]
      if (!first || first.t >= cutoff) break
      samples.shift()
    }
  }

  // px/s between the oldest and newest sample over the time between them.
  function computeRaw(): number {
    if (samples.length < 2) return 0
    const first = samples[0]
    const last = samples[samples.length - 1]
    if (!first || !last) return 0
    const dt = (last.t - first.t) / 1000
    if (dt <= 0) return 0
    return (last.y - first.y) / dt
  }

  function onScroll(): void {
    const t = performance.now()
    pushSample(window.scrollY, t)
    rawVelocity = computeRaw()
    lastScrollEventTime = t
  }

  function tick(): void {
    // Decay toward rest once scrolling has paused for `timeout` ms.
    if (performance.now() - lastScrollEventTime > timeout) {
      rawVelocity = lerp(rawVelocity, 0, 0.25)
    }

    // Ease the public value toward the raw reading, snapping tiny values to 0.
    const next = lerp(velocity.value, rawVelocity, smoothing)
    velocity.value = Math.abs(next) < 0.01 ? 0 : next

    direction.value =
      velocity.value > 1 ? 'down' : velocity.value < -1 ? 'up' : 'idle'
  }

  onMounted(() => {
    // Reduced motion: leave velocity at 0 — no listeners, no loop.
    if (reduced.value) return

    lastScrollEventTime = performance.now()
    window.addEventListener('scroll', onScroll, { passive: true })
    const stopRaf = add(tick)

    onBeforeUnmount(() => {
      window.removeEventListener('scroll', onScroll)
      stopRaf()
    })
  })

  return { velocity, direction }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

This file lives in `composables/` so Nuxt 4 auto-imports it — no import
statement needed.

`velocity` is a reactive smoothed px/s value (signed). Map it to whatever you
want to drive — skew, scale, a CSS variable, marquee speed.

SKEW ON SCROLL (the classic look)

<script setup lang="ts">
const el = useTemplateRef<HTMLElement>('el')
const { velocity } = useScrollVelocity()
const { add } = useRaf()

onMounted(() => {
  const stop = add(() => {
    // clamp so fast flicks don't over-shear
    const skew = Math.max(-12, Math.min(12, velocity.value * 0.01))
    if (el.value) el.value.style.transform = `skewY(${skew}deg)`
  })
  onUnmounted(stop)
})
</script>

<template>
  <section ref="el">…content that shears as you scroll…</section>
</template>

DRIVE A CSS VARIABLE INSTEAD

  const { velocity } = useScrollVelocity()
  watchEffect(() => {
    document.documentElement.style.setProperty(
      '--scroll-velocity', String(velocity.value),
    )
  })

NOTE
  Reads window.scrollY, so it works with Lenis (which writes native scroll).
  Under prefers-reduced-motion it stays at 0 — your skew/distortion simply
  won't apply, which is the correct accessible fallback.
──────────────────────────────────────────────────────────────────────
*/
