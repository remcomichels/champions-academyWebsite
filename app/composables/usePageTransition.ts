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
  /** CSS selector for the destination-name label. Default: '.pageTransition-label'. */
  labelSelector?: string
  /** Duration of each half (cover, then reveal), in seconds. Default: 0.5. */
  duration?: number
  /** GSAP ease. Default: 'power3.inOut'. */
  ease?: string
  /**
   * Seconds to wait, once covered, before revealing anyway if `page:finish`
   * never fires. Deliberately generous — a slow CMS fetch delays the mount,
   * and cutting a legitimate transition short is worse than a longer hold.
   * Default: 4.
   */
  failsafe?: number
}

/**
 * Destination name for the overlay, derived from the path so it keeps working
 * as CMS pages are added: '/' is Home, '/benefits' is Benefits, and a nested or
 * hyphenated slug becomes its last segment in title case.
 */
function labelForPath(path: string): string {
  const slug = path.split(/[?#]/)[0]?.split('/').filter(Boolean).pop()
  if (!slug) return 'Home'
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
 * The reveal is backstopped by a timer (`failsafe`), so a navigation that never
 * completes can't leave the site stranded behind the black panel.
 *
 * Call it once from app.vue. The overlay markup lives there too:
 *   <div class="pageTransition" />
 */
export function usePageTransition(options: PageTransitionOptions = {}): void {
  const {
    selector = '.pageTransition',
    labelSelector = '.pageTransition-label',
    duration = 0.5,
    ease = 'power3.inOut',
    failsafe = 4,
  } = options

  const pageTransitioning = useState('pageTransitioning', () => false)
  const pageTransitionLabel = useState('pageTransitionLabel', () => '')
  const { reduced } = useReducedMotion()

  const router = useRouter()
  const nuxtApp = useNuxtApp()

  onMounted(() => {
    const el = document.querySelector<HTMLElement>(selector)

    // Reduced motion (or no overlay): navigate normally, no transition.
    if (!el || reduced.value) return

    const label = document.querySelector<HTMLElement>(labelSelector)

    // Park the overlay just below the viewport, ready to slide up.
    //
    // `y: 0` matters. The CSS parks it with transform: translateY(100%), which
    // computes to a matrix, so GSAP reads that as y: 900px and then adds its own
    // yPercent on top — the element ends up two viewports down and its "covered"
    // position is one viewport below the screen, so the overlay never shows.
    // Zeroing y hands the whole transform to yPercent.
    gsap.set(el, { yPercent: 100, y: 0 })

    let failsafeId: ReturnType<typeof setTimeout> | null = null
    // Synchronous latch. `pageTransitioning` only clears once the reveal has
    // finished playing, so it can't stop the failsafe and `page:finish` firing
    // near-simultaneously from starting two overlapping timelines.
    let revealing = false

    function clearFailsafe(): void {
      if (failsafeId === null) return
      clearTimeout(failsafeId)
      failsafeId = null
    }

    /**
     * Uncovers the screen, re-fires initPage for the new page and clears the
     * flag. Safe to call more than once — the second call is a no-op.
     */
    async function reveal(): Promise<void> {
      clearFailsafe()
      if (!pageTransitioning.value || revealing) return
      revealing = true

      const tl = gsap.timeline()
      if (label) tl.to(label, { opacity: 0, duration: 0.2, ease: 'power2.in' })
      tl.to(el, { yPercent: -100, duration, ease }, label ? '-=0.05' : 0)
      await tl

      gsap.set(el, { yPercent: 100 })
      document.dispatchEvent(new Event('initPage'))
      pageTransitioning.value = false
      revealing = false
    }

    // Before navigating: cover the screen and hold navigation until fully covered.
    const removeGuard = router.beforeEach(async (to, from) => {
      // Same path — an in-page anchor like /#about, or a query change. No page
      // mounts, so `page:finish` never fires and the overlay would cover and
      // stay there. Let the browser scroll to the section instead.
      if (to.path === from.path) return

      pageTransitioning.value = true
      pageTransitionLabel.value = labelForPath(to.path)

      const cover = gsap.timeline()
      cover.to(el, { yPercent: 0, duration, ease })
      // Fades in over the tail of the slide, so the name settles as the screen
      // finishes covering rather than travelling up with the panel.
      if (label) cover.to(label, { opacity: 1, duration: 0.25, ease: 'power2.out' }, '-=0.2')
      await cover

      // Nothing else guarantees the reveal: `page:finish` is the only thing that
      // uncovers the screen, and it never fires if the navigation is aborted,
      // errors, or hangs on a stalled data fetch — leaving the site behind a
      // black panel with no way out. Uncover regardless once this elapses.
      clearFailsafe()
      failsafeId = setTimeout(reveal, failsafe * 1000)
    })

    // After the new page mounts: reveal it (cancelling the failsafe on the way).
    const stopHook = nuxtApp.hook('page:finish', reveal)

    onBeforeUnmount(() => {
      clearFailsafe()
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

FAILSAFE
  `page:finish` is the only thing that uncovers the screen, so anything that
  stops it firing — an aborted navigation, a route error, a stalled CMS fetch —
  would strand the site behind the panel. A timer started once covered reveals
  regardless after `failsafe` seconds (default 4).

  It's set long on purpose: the timer measures time-to-mount, so a slow data
  fetch on a real navigation sits inside that window. Shortening it to ~1s would
  start cutting legitimate transitions short on slow connections, snapping the
  panel away over the *old* page. Raise it, don't lower it.

    usePageTransition({ failsafe: 6 })
──────────────────────────────────────────────────────────────────────
*/
