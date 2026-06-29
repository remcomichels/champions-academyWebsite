import { gsap } from 'gsap'

// ─────────────────────────────────────────────────────────────────────────────
// useRaf
//
// One requestAnimationFrame loop for the whole app. Instead of every composable
// spinning up its own rAF (marquee, magnetic float, etc.), subscribers ride
// GSAP's existing ticker — the same clock that already drives every tween and
// ScrollTrigger. Lenis is folded onto it too (see plugins/lenis.client.ts), so
// at runtime there is a single rAF feeding everything.
//
// Why wrap gsap.ticker instead of rolling our own loop:
//   • GSAP is already running a ticker we can't turn off, so a second loop would
//     mean two master clocks. Wrapping it keeps the count at exactly one.
//   • Free lag smoothing, frame counting, and a stable time base.
//   • Callbacks fire in sync with tweens/ScrollTrigger — no ordering races.
// ─────────────────────────────────────────────────────────────────────────────

// Signature of a ticker subscriber.
//   time      — total seconds the ticker has been running
//   deltaTime — milliseconds since the previous tick (use this for frame-rate
//               independent motion; already smoothed by GSAP)
//   frame     — monotonically increasing frame counter
export type RafCallback = (time: number, deltaTime: number, frame: number) => void

interface UseRafReturn {
  /** Subscribe to the shared loop. Returns an unsubscribe function. */
  add: (callback: RafCallback) => () => void
  /** Unsubscribe a callback previously passed to add(). */
  remove: (callback: RafCallback) => void
}

export function useRaf(): UseRafReturn {
  function add(callback: RafCallback): () => void {
    // No rAF on the server — return a no-op disposer so callers can still
    // unconditionally store the result.
    if (import.meta.server) return () => {}

    gsap.ticker.add(callback)
    return () => gsap.ticker.remove(callback)
  }

  function remove(callback: RafCallback): void {
    if (import.meta.server) return
    gsap.ticker.remove(callback)
  }

  return { add, remove }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE / COMPOSABLE
──────────────────────────────────────────────────────────────────────

This file lives in `composables/` so Nuxt 4 auto-imports it — no import
statement needed.

ALWAYS unsubscribe in onUnmounted (or your composable's destroy()) — a
leaked callback runs forever, on every frame, for the life of the page.

<script setup lang="ts">
const { add } = useRaf()

onMounted(() => {
  // deltaTime is milliseconds since the last frame — multiply your speeds
  // by it so motion stays consistent regardless of refresh rate.
  const stop = add((time, deltaTime) => {
    el.value!.style.transform = `translateX(${(time * 60).toFixed(2)}px)`
  })

  // Either capture the returned disposer…
  onUnmounted(stop)
})
</script>

  // …or remove by reference:
  // const { add, remove } = useRaf()
  // const tick = (t: number, dt: number) => { ... }
  // add(tick)
  // onUnmounted(() => remove(tick))
──────────────────────────────────────────────────────────────────────
*/
