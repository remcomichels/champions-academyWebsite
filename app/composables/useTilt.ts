import type { Ref } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// useTilt
//
// 3D pointer tilt for a card — eases rotateX/rotateY toward the pointer with a
// slight scale, easing back to flat on leave. Rides the shared rAF and pairs
// with useMagnetic. Skipped entirely under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TiltOptions {
  /**
   * Maximum rotation in degrees at the card's edges (each axis).
   * Default: 12.
   */
  max?: number
  /**
   * CSS perspective in px — smaller = stronger 3D depth.
   * Default: 1000.
   */
  perspective?: number
  /**
   * Scale applied while the pointer is over the card.
   * Default: 1.02.
   */
  scale?: number
  /**
   * Per-frame easing (0–1) toward the target rotation/scale. Lower = smoother/laggier.
   * Default: 0.15.
   */
  lerp?: number
}

interface UseTiltReturn {
  /** Tear down: remove listeners, leave the loop, clear the transform. Idempotent. */
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 3D pointer tilt for a card. Rotates the element toward the pointer with an
 * eased follow (on the shared rAF, see useRaf) and a slight scale, easing back
 * to flat on leave. Pairs naturally with useMagnetic.
 *
 * The composable owns the element's `transform`, so don't set one in CSS.
 * Self-wires its lifecycle. Does nothing under reduced motion.
 *
 * @param target  Ref to the card element to tilt.
 */
export function useTilt(
  target: Ref<HTMLElement | null>,
  options: TiltOptions = {},
): UseTiltReturn {
  const {
    max = 12,
    perspective = 1000,
    scale = 1.02,
    lerp: lerpFactor = 0.15,
  } = options

  const { add, remove } = useRaf()
  const { reduced } = useReducedMotion()

  let running = false
  let hovering = false
  let destroyed = false

  // current (drawn) vs target (desired) rotation/scale.
  let curRx = 0
  let curRy = 0
  let curS = 1
  let tgtRx = 0
  let tgtRy = 0
  let tgtS = 1

  function tick(): void {
    curRx = lerp(curRx, tgtRx, lerpFactor)
    curRy = lerp(curRy, tgtRy, lerpFactor)
    curS = lerp(curS, tgtS, lerpFactor)

    const el = target.value
    if (el) {
      el.style.transform =
        `perspective(${perspective}px) rotateX(${curRx.toFixed(3)}deg) ` +
        `rotateY(${curRy.toFixed(3)}deg) scale(${curS.toFixed(4)})`
    }

    // Settled back to rest after leaving — drop off the shared loop and clear.
    if (!hovering && Math.abs(curRx) < 0.01 && Math.abs(curRy) < 0.01 && Math.abs(curS - 1) < 0.001) {
      running = false
      remove(tick)
      if (el) el.style.transform = ''
    }
  }

  function startTick(): void {
    if (running) return
    running = true
    add(tick)
  }

  function onMove(e: MouseEvent): void {
    const el = target.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width   // 0 → 1 across
    const py = (e.clientY - r.top) / r.height    // 0 → 1 down
    tgtRy = (px - 0.5) * 2 * max                  // left/right → rotateY
    tgtRx = -(py - 0.5) * 2 * max                 // up/down → rotateX (inverted feels natural)
    startTick()
  }

  function onEnter(): void {
    hovering = true
    tgtS = scale
    startTick()
  }

  function onLeave(): void {
    hovering = false
    tgtRx = 0
    tgtRy = 0
    tgtS = 1
    startTick()
  }

  onMounted(() => {
    if (reduced.value) return
    const el = target.value
    if (!el) return
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
  })

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    const el = target.value
    el?.removeEventListener('mouseenter', onEnter)
    el?.removeEventListener('mousemove', onMove)
    el?.removeEventListener('mouseleave', onLeave)
    remove(tick)
    running = false
    if (el) el.style.transform = ''
  }

  onBeforeUnmount(destroy)

  return { destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed.

<script setup lang="ts">
const card = useTemplateRef<HTMLElement>('card')
useTilt(card, {
  // All options are optional — shown here for clarity
  max:         12,   // max degrees at the edges
  perspective: 1000, // px — smaller = deeper
  scale:       1.02, // grow slightly while hovered
  lerp:        0.15, // follow smoothing
})
</script>

<template>
  <article ref="card" class="card">…</article>
</template>

NOTES
  • The composable owns the card's `transform` — don't set one in CSS on the
    same element. Put inner depth/parallax on child elements if you want layers.
  • Add `transform-style: preserve-3d` on the card and `translateZ()` on children
    for a layered pop. Skipped entirely under prefers-reduced-motion.
──────────────────────────────────────────────────────────────────────
*/
