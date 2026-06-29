import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

// -------------------------------------------------------------------
// useLetterAnimation
//
// Per-letter blur + fade reveal via SplitText — splits text on mount and
// animates each letter in once the intro is done ([data-letters]) or on scroll
// ([data-scroll-letters]). Shows the text as-is under reduced motion.
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface LetterAnimationOptions {
  /**
   * ScrollTrigger `start` for [data-scroll-letters] elements.
   * Default: '0% 80%'.
   */
  scrollStart?: string
  /**
   * Viewport width (px) below which elements marked
   * data-scroll-mobile-ignore="true" are skipped entirely.
   * Default: 580.
   */
  mobileBreakpoint?: number
  /**
   * GSAP tween duration per letter, in seconds.
   * Default: 0.9.
   */
  duration?: number
  /**
   * Per-letter delay multiplier (seconds) — letter `i` starts at staggerDelay * i.
   * Default: 0.03.
   */
  staggerDelay?: number
  /**
   * Starting blur in px; each letter animates from blur(blurAmount) → blur(0).
   * Default: 6.
   */
  blurAmount?: number
}

interface UseLetterAnimationReturn {
  /** Split [data-letters] / [data-scroll-letters] now; animate once the intro is done. */
  initLetters: () => void
  /** Animate the .letter spans inside a single element — exposed for manual triggering. */
  animLetters: (el: HTMLElement) => void
  /** Kill all ScrollTriggers and stop the intro/transition watchers. */
  destroy: () => void
}

// -------------------------------------------------------------------
// Composable
// -------------------------------------------------------------------

export function useLetterAnimation(
  options: LetterAnimationOptions = {}
): UseLetterAnimationReturn {
  const {
    scrollStart = '0% 80%',
    mobileBreakpoint = 580,
    duration = 0.9,
    staggerDelay = 0.03,
    blurAmount = 6,
  } = options

  const scrollTriggers: ScrollTrigger[] = []

  // Per-instance flag: initLetters() was called but intro wasn't done yet
  let _pendingAnim = false

  // Shared Nuxt state — initialized to false in app.vue, set to true by IntroAnimation on complete.
  const introComplete = useState('introComplete', () => false)

  const { reduced } = useReducedMotion()

  // -------------------------------------------------------------------
  // animLetters
  // -------------------------------------------------------------------

  function animLetters(el: HTMLElement): void {
    const lines = el.querySelectorAll<HTMLElement>('.line')

    lines.forEach((line) => {
      const letters = line.querySelectorAll<HTMLElement>('.letter')
      letters.forEach((letter, i) => {
        gsap.fromTo(
          letter,
          { filter: `blur(${blurAmount}px)`, opacity: 0 },
          {
            filter: 'blur(0px)',
            opacity: 1,
            duration,
            delay: staggerDelay * i,
            ease: 'power3.out',
          }
        )
      })
    })
  }

  // -------------------------------------------------------------------
  // splitAndHide
  // Splits text, hides letters, then reveals the parent.
  // Order matters: parent opacity: 1 is set AFTER letters are opacity: 0,
  // so the unsplit text is never flashed.
  // -------------------------------------------------------------------

  function splitAndHide(el: HTMLElement): void {
    new SplitText(el, {
      type: 'lines,words,chars',
      linesClass: 'line',
      charsClass: 'letter',
    })
    gsap.set(el.querySelectorAll('.letter'), {
      filter: `blur(${blurAmount}px)`,
      opacity: 0,
    })
    // Reveal parent now that individual letters are already hidden.
    // This clears any CSS opacity: 0 used to prevent SSR flash.
    gsap.set(el, { opacity: 1 })
  }

  // -------------------------------------------------------------------
  // _doSplit  — splits all [data-letters] and [data-scroll-letters] immediately
  // -------------------------------------------------------------------

  function _doSplit(): void {
    // ── [data-letters] ──────────────────────────────────────────────
    document.querySelectorAll<HTMLElement>('[data-letters]').forEach((el) => {
      if (el.dataset.lettersInitialized) return
      splitAndHide(el)
      el.dataset.lettersInitialized = 'true'
    })

    // ── [data-scroll-letters] — split only, ScrollTriggers created in _doScrollTriggers
    const viewportWidth = window.innerWidth

    document.querySelectorAll<HTMLElement>('[data-scroll-letters]').forEach((el) => {
      if (el.dataset.lettersInitialized) return

      const ignoreMobile = el.dataset.scrollMobileIgnore === 'true'
      if (ignoreMobile && viewportWidth < mobileBreakpoint) return

      splitAndHide(el)
      el.dataset.lettersInitialized = 'true'
    })
  }

  // -------------------------------------------------------------------
  // _doScrollTriggers  — creates ScrollTriggers for [data-scroll-letters]
  // Called after page is ready (intro done / transition complete)
  // -------------------------------------------------------------------

  function _doScrollTriggers(): void {
    const viewportWidth = window.innerWidth

    document.querySelectorAll<HTMLElement>('[data-scroll-letters]').forEach((el) => {
      if (el.dataset.scrollTriggered) return

      const ignoreMobile = el.dataset.scrollMobileIgnore === 'true'
      if (ignoreMobile && viewportWidth < mobileBreakpoint) return

      el.dataset.scrollTriggered = 'true'

      const isDirect = el.dataset.scrollDirect === 'true'

      const trigger = ScrollTrigger.create({
        trigger: el,
        start: isDirect ? '0% 100%' : scrollStart,
        end: isDirect ? '0% 100%' : '0 80%',
        once: true,
        onEnter() {
          animLetters(el)
        },
      })

      scrollTriggers.push(trigger)
    })
  }

  // -------------------------------------------------------------------
  // _doAnimate  — fires letter animations for all [data-letters] elements
  // -------------------------------------------------------------------

  function _doAnimate(): void {
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('[data-letters]').forEach((el) => {
        // Guard against double-animation when multiple components call initLetters()
        if (el.dataset.lettersAnimated) return
        el.dataset.lettersAnimated = 'true'
        animLetters(el)
      })
      _doScrollTriggers()
    })
  }

  // -------------------------------------------------------------------
  // initLetters  — public API called from onMounted
  // Splits immediately, animates only once the intro is done.
  // -------------------------------------------------------------------

  function initLetters(): void {
    // Reduced motion: show the text as-is (no split, no blur reveal).
    if (reduced.value) {
      document
        .querySelectorAll<HTMLElement>('[data-letters],[data-scroll-letters]')
        .forEach((el) => gsap.set(el, { opacity: 1 }))
      return
    }

    _doSplit()

    const pageTransitioning = useState('pageTransitioning', () => false)

    if (introComplete.value && !pageTransitioning.value) {
      _doAnimate()
    } else {
      _pendingAnim = true
    }
  }

  // -------------------------------------------------------------------
  // destroy  (call in onUnmounted to prevent memory leaks)
  // -------------------------------------------------------------------

  let _stopIntroWatch: (() => void) | null = null

  function destroy(): void {
    scrollTriggers.forEach((st) => st.kill())
    scrollTriggers.length = 0
    _stopIntroWatch?.()
    _stopIntroWatch = null
  }

  // -------------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------------

  if (import.meta.client) {
    const pageTransitioning = useState('pageTransitioning', () => false)

    // ── Initial load: animate once intro overlay is gone ──────────────────────
    const stopIntroWatch = watch(introComplete, (val) => {
      if (val && _pendingAnim) {
        _pendingAnim = false
        _doAnimate()
      }
    })

    // ── Page transitions: animate once overlay has slid away ──────────────────
    const stopTransitionWatch = watch(pageTransitioning, (val) => {
      if (!val && _pendingAnim) {
        _pendingAnim = false
        _doAnimate()
      }
    })

    _stopIntroWatch = () => {
      stopIntroWatch()
      stopTransitionWatch()
    }

  }

  return { initLetters, animLetters, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

Because this file lives in the `composables/` directory, Nuxt 4
auto-imports it — no import statement needed anywhere.

Each letter animates from blur(Xpx) + opacity 0  →  blur(0px) + opacity 1.
No translate or rotate — clean in-place reveal.

<script setup lang="ts">
const { initLetters, destroy } = useLetterAnimation({
  // All options are optional — shown here for clarity
  scrollStart:     '0% 90%',   // ScrollTrigger start for scroll-letters els
  mobileBreakpoint: 580,       // skip scroll-mobile-ignore below this px
  duration:         0.8,       // GSAP tween duration per letter
  staggerDelay:     0.025,     // per-letter delay multiplier (seconds)
  blurAmount:       8,         // starting blur in px
})

onMounted(() => initLetters())
onUnmounted(() => destroy())
</script>

<template>
  <!-- Split + animate immediately on mount -->
  <h1 data-letters>Hello World</h1>

  <!-- Animate on scroll (triggers when element hits 90% of viewport) -->
  <h2 data-scroll-letters>Scroll triggered title</h2>

  <!-- Animate on scroll at very bottom of viewport -->
  <h3 data-scroll-letters data-scroll-direct="true">Direct scroll title</h3>

  <!-- Animate on scroll, skip on mobile -->
  <h3 data-scroll-letters data-scroll-mobile-ignore="true">Desktop only</h3>
</template>
──────────────────────────────────────────────────────────────────────
*/
