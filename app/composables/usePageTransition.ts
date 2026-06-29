import { gsap } from 'gsap'

// ─────────────────────────────────────────────────────────────────────────────
// usePageTransition
//
// Route-change transition. Covers the screen on navigation (holding navigation
// until covered), reveals once the new page has mounted, and toggles
// `pageTransitioning` so the reveal composables re-run. Never runs on first
// load (that's useIntro); a no-op under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PageTransitionOptions {
  /** CSS selector for the overlay element (rendered in app.vue). Default: '.pageTransition'. */
  selector?: string
  /** Duration of each half (cover, then reveal), in seconds. Default: 0.5. */
  duration?: number
  /** GSAP ease. Default: 'power3.inOut'. */
  ease?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route-change transition. On navigation it slides an overlay up to cover the
 * screen (holding navigation until covered), lets the new page mount underneath,
 * then slides the overlay away — toggling `pageTransitioning` so the reveal
 * composables re-run for the new page, and re-firing initPage for the
 * event-driven ones.
 *
 * Distinct from useIntro: this never runs on first load (the guard is attached
 * after the initial route has resolved), only on subsequent navigations.
 *
 * Under reduced motion it does nothing — navigation happens instantly with no
 * overlay (the reveal composables handle reduced motion on their own).
 *
 * Call it once from app.vue. The overlay markup lives there too:
 *   <div class="pageTransition" />
 */
export function usePageTransition(options: PageTransitionOptions = {}): void {
  const {
    selector = '.pageTransition',
    duration = 0.5,
    ease = 'power3.inOut',
  } = options

  const pageTransitioning = useState('pageTransitioning', () => false)
  const { reduced } = useReducedMotion()

  const router = useRouter()
  const nuxtApp = useNuxtApp()

  onMounted(() => {
    const el = document.querySelector<HTMLElement>(selector)

    // Reduced motion (or no overlay): navigate normally, no transition.
    if (!el || reduced.value) return

    // Park the overlay just below the viewport, ready to slide up.
    gsap.set(el, { yPercent: 100 })

    // Before navigating: cover the screen and hold navigation until fully covered.
    const removeGuard = router.beforeEach(async () => {
      pageTransitioning.value = true
      await gsap.to(el, { yPercent: 0, duration, ease })
    })

    // After the new page mounts: reveal it, reset the overlay below, re-fire
    // initPage for the new page, and clear the flag.
    const stopHook = nuxtApp.hook('page:finish', async () => {
      if (!pageTransitioning.value) return
      await gsap.to(el, { yPercent: -100, duration, ease })
      gsap.set(el, { yPercent: 100 })
      document.dispatchEvent(new Event('initPage'))
      pageTransitioning.value = false
    })

    onBeforeUnmount(() => {
      removeGuard()
      stopHook()
    })
  })
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed. Call once in app.vue and render the
overlay alongside <NuxtLayout>:

<script setup lang="ts">
useIntro()
usePageTransition()
</script>

<template>
  <div class="intro" />
  <div class="pageTransition" />
  <NuxtLayout />
</template>

CSS (app/assets/less/components/transitions.less — already imported via main.less)
  The composable owns `transform` (yPercent); style the rest. Keep it parked
  below the viewport so it never shows until a transition runs.

  .pageTransition {
    .fixed(100vh, 100%, 0, 0);
    z-index: 9998;
    background-color: @black;
    transform: translateY(100%);   // GSAP takes over on mount
  }

VARIATIONS
  • Wipe from the side: animate xPercent instead of yPercent.
  • Two-tone shutter: nest two coloured panels and offset their tweens.
  • Lock scrolling while covered by toggling html.stop-scroll (and lenis.stop())
    inside the guard/hook if you want it.
──────────────────────────────────────────────────────────────────────
*/
