// ─────────────────────────────────────────────────────────────────────────────
// useCustomCursor
//
// Follower cursor — generates one element that eases toward the pointer (on the
// shared rAF) and exposes a `data-cursor` state hook so CSS can grow it, show
// "view", invert, etc. The native cursor stays under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CustomCursorOptions {
  /**
   * Class applied to the generated cursor element — style it (and its states)
   * in LESS.
   * Default: 'cursor'.
   */
  className?: string
  /**
   * Per-frame follow easing (0–1). Lower = laggier/heavier trail.
   * Default: 0.18.
   */
  lerp?: number
  /**
   * Hide the native system cursor while active.
   * Default: true.
   */
  hideNative?: boolean
}

interface UseCustomCursorReturn {
  /** Tear down: remove the element, listeners, and leave the shared loop. Idempotent. */
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
 * Follower cursor — the signature award-site interaction. Generates one element
 * that eases toward the pointer (on the shared rAF, see useRaf) and exposes a
 * state hook: any element with `data-cursor="<state>"` sets `data-state` on the
 * cursor while hovered, so you can grow it, show "view", invert, etc. purely in
 * CSS.
 *
 * The composable owns only position + state; ALL appearance (size, colour,
 * blend mode, per-state looks) lives in your LESS. Self-wires its lifecycle.
 *
 * Under reduced motion it does nothing — the native cursor stays, which is the
 * correct accessible fallback.
 */
export function useCustomCursor(
  options: CustomCursorOptions = {},
): UseCustomCursorReturn {
  const {
    className = 'cursor',
    lerp: lerpFactor = 0.18,
    hideNative = true,
  } = options

  const { add } = useRaf()
  const { reduced } = useReducedMotion()

  let cursor: HTMLElement | null = null
  let stopRaf: (() => void) | null = null
  let destroyed = false

  // target (tx,ty) follows the pointer; (cx,cy) is the eased position drawn.
  let tx = 0
  let ty = 0
  let cx = 0
  let cy = 0
  let placed = false

  function onMove(e: MouseEvent): void {
    tx = e.clientX
    ty = e.clientY
    // Snap to the pointer on the first move so it doesn't fly in from 0,0.
    if (!placed) { cx = tx; cy = ty; placed = true }
  }

  // Event delegation: the nearest [data-cursor] ancestor drives the state.
  function onOver(e: MouseEvent): void {
    const el = (e.target as HTMLElement)?.closest?.('[data-cursor]') as HTMLElement | null
    if (el && cursor) cursor.dataset.state = el.dataset.cursor || 'active'
  }
  function onOut(e: MouseEvent): void {
    const el = (e.target as HTMLElement)?.closest?.('[data-cursor]') as HTMLElement | null
    if (el && cursor) delete cursor.dataset.state
  }

  function tick(): void {
    if (!cursor) return
    cx = lerp(cx, tx, lerpFactor)
    cy = lerp(cy, ty, lerpFactor)
    // translate(-50%, -50%) centres the element on the pointer regardless of size.
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`
  }

  onMounted(() => {
    // Reduced motion: keep the native cursor, build nothing.
    if (reduced.value) return

    cursor = document.createElement('div')
    cursor.className = className
    const s = cursor.style
    s.position = 'fixed'
    s.left = '0'
    s.top = '0'
    s.pointerEvents = 'none'
    s.zIndex = '9999'
    s.willChange = 'transform'
    document.body.appendChild(cursor)

    if (hideNative) document.documentElement.style.cursor = 'none'

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseover', onOver, { passive: true })
    document.addEventListener('mouseout', onOut, { passive: true })
    stopRaf = add(tick)
  })

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    window.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseover', onOver)
    document.removeEventListener('mouseout', onOut)
    stopRaf?.()
    stopRaf = null
    if (hideNative) document.documentElement.style.cursor = ''
    cursor?.remove()
    cursor = null
  }

  onBeforeUnmount(destroy)

  return { destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed. Best mounted once, high up (e.g. in
layouts/default.vue), so a single cursor follows across the whole site.

<script setup lang="ts">
useCustomCursor() // self-wires its own lifecycle; capture { destroy } if you need manual control
</script>

<template>
  <a href="/work" data-cursor="view">Our work</a>   <!-- sets .cursor[data-state="view"] -->
  <button data-cursor="text">Drag</button>
</template>

CSS SETUP (required — the composable only positions the element)

  .cursor {
    width: 16px; height: 16px;
    border-radius: 50%;
    background: @white;
    mix-blend-mode: difference;          // the classic invert-on-everything look
    transition: width .3s @ease, height .3s @ease, background .3s @ease;
  }
  // Grow it into a "view" bubble on links/media
  .cursor[data-state="view"] {
    width: 80px; height: 80px;
  }

NOTES
  • Size/colour/blend/state looks are all yours in CSS — the composable never
    touches them, only `transform` (position) and `data-state`.
  • Don't set `transform` on .cursor in CSS; the composable overwrites it each
    frame. Animate size/background/opacity for state changes instead.
  • Consider only mounting it on fine pointers:
      if (!window.matchMedia('(pointer: fine)').matches) return  // before calling
──────────────────────────────────────────────────────────────────────
*/
