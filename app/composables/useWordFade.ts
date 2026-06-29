import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

// Register GSAP plugins once at module level — safe to call multiple times
gsap.registerPlugin(ScrollTrigger, SplitText)

// ─────────────────────────────────────────────────────────────────────────────
// useWordFade
//
// Scrubbed word-by-word opacity fade as you scroll through a block (SplitText) —
// each word lights up in sequence, tied directly to scroll position. Unsplit
// and fully visible under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options accepted by useWordFade().
 * All fields are optional — sensible defaults are applied for every one.
 */
interface WordFadeOptions {
  /**
   * Name of the custom DOM event that triggers initWordFade().
   * Fire it with: document.dispatchEvent(new Event('initPage'))
   * Default: "initPage"
   */
  triggerEvent?: string

  /**
   * Starting opacity of each word before it has been scrolled into focus.
   * Words begin at this opacity and animate up to 1 as the user scrolls.
   * Default: 0.2
   */
  opacityFrom?: number

  /**
   * ScrollTrigger `start` position for the animation.
   * Default: "top 80%"
   */
  scrollStart?: string

  /**
   * ScrollTrigger `end` position for the animation.
   * Controls how much scroll distance the full fade takes.
   * Default: "bottom 20%"
   */
  scrollEnd?: string

  /**
   * How tightly the animation is scrubbed to the scroll position.
   * true = perfectly in sync, number = seconds of lag/smoothing.
   * Default: true
   */
  scrub?: boolean | number
}

/**
 * Shape of the object returned by useWordFade().
 */
interface UseWordFadeReturn {
  /** Scan the DOM for [data-word-fade] elements and set up the animations */
  initWordFade: () => void
  /** Kill all ScrollTrigger instances and remove the event listener */
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export function useWordFade(
  options: WordFadeOptions = {}
): UseWordFadeReturn {
  // Destructure with defaults so every internal reference is a plain value —
  // no optional chaining needed further down
  const {
    triggerEvent = 'initPage',
    opacityFrom  = 0.2,
    scrollStart  = 'top 70%',
    scrollEnd    = 'bottom 70%',
    scrub        = true,
  } = options

  // Collect every ScrollTrigger we create so destroy() can kill them all
  const scrollTriggers: ScrollTrigger[] = []

  const { reduced } = useReducedMotion()

  // ─────────────────────────────────────────────────────────────────────────
  // initWordFade
  // Finds every [data-word-fade] element, splits it into individual word
  // spans with SplitText, then creates a scrubbed GSAP timeline per element
  // that fades each word from `opacityFrom` to 1 in sequence as the user
  // scrolls through it.
  //
  // Because the animation is scrubbed to scroll position (not time-based),
  // words light up progressively as the user moves down the page and dim
  // again if they scroll back up.
  //
  // Safe to call multiple times — the data-word-fade-initialized guard
  // prevents elements from being split and wired up more than once.
  // ─────────────────────────────────────────────────────────────────────────

  function initWordFade(): void {
    // Reduced motion: leave the text unsplit and fully visible.
    if (reduced.value) return

    const els = document.querySelectorAll<HTMLElement>('[data-word-fade]')

    els.forEach((el) => {
      // Skip elements that have already been initialized
      if (el.dataset.wordFadeInitialized) return

      // Split the element's text into individual word spans.
      // Each word becomes an independently animatable <span class="wf-word">
      const split = new SplitText(el, {
        type: 'words',
        wordsClass: 'wf-word',
      })

      const words = split.words as HTMLElement[]

      // Set all words to their starting opacity immediately so there's no
      // flash of full-opacity text before ScrollTrigger initializes
      gsap.set(words, { opacity: opacityFrom })

      // Build a staggered timeline where each word fades to full opacity
      // one after the other. The timeline is then scrubbed to the scroll
      // position so the reveal speed is entirely controlled by the user.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: scrollStart,
          end: scrollEnd,
          scrub,
        },
      })

      // Each word gets an equal slice of the timeline.
      // stagger: 1 means each word's tween is offset by the duration of
      // one word — they animate sequentially rather than all at once.
      tl.to(words, {
        opacity: 1,
        duration: 1,
        stagger: 1,
        ease: 'none', // linear so the fade tracks scroll 1:1
      })

      // Store the ScrollTrigger reference for cleanup
      if (tl.scrollTrigger) {
        scrollTriggers.push(tl.scrollTrigger)
      }

      // Mark as initialized so re-calling initWordFade() skips this element
      el.dataset.wordFadeInitialized = 'true'
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // destroy
  // Must be called in onUnmounted() to prevent ScrollTrigger instances and
  // the document event listener from leaking across page navigations.
  // ─────────────────────────────────────────────────────────────────────────

  function destroy(): void {
    // Kill and clear every ScrollTrigger this composable created
    scrollTriggers.forEach((st) => st.kill())
    scrollTriggers.length = 0

    // Remove the document-level event listener registered in the bootstrap below
    document.removeEventListener(triggerEvent, initWordFade)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bootstrap
  // Waits for all fonts to finish loading before attaching the trigger event,
  // preventing SplitText from measuring word widths before custom fonts are
  // applied (which would produce incorrect word splits and layout).
  // Guarded by import.meta.client so it never runs during SSR.
  // ─────────────────────────────────────────────────────────────────────────

  if (import.meta.client) {
    document.fonts.ready.then(() => {
      document.addEventListener(triggerEvent, initWordFade)
    })
  }

  return { initWordFade, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

Place this file in `composables/useWordFade.ts` and Nuxt 4 will
auto-import it — no import statement needed in your .vue files.

<script setup lang="ts">
const { initWordFade, destroy } = useWordFade({
  // All options are optional — shown here for clarity
  triggerEvent: 'initPage',  // custom event name that calls initWordFade()
  opacityFrom:  0.2,         // starting opacity of each word (0–1)
  scrollStart:  'top 80%',   // when the animation begins
  scrollEnd:    'bottom 20%', // when all words have faded to full opacity
  scrub:        true,         // true = locked to scroll, number = smoothing lag
})

onMounted(() => {
  // Option A — call directly after mount
  initWordFade()

  // Option B — dispatch the custom event
  // document.dispatchEvent(new Event('initPage'))
})

onUnmounted(() => {
  // Always call destroy() — kills ScrollTriggers and the event listener
  destroy()
})
</script>

<template>
  <!--
    data-word-fade
      Splits the element into words and scrubs their opacity from
      `opacityFrom` (default 0.2) to 1 as the user scrolls.
      Words reveal sequentially — the first word fades in first,
      then the second, and so on through to the last word.
      Scrolling back up reverses the animation.

    Combine with per-element overrides using inline style or
    wrapper classes to vary timing across different blocks.
  -->

  <!-- Basic usage — all defaults -->
  <p data-word-fade>
    This text will fade in word by word as you scroll through it.
  </p>

  <!-- Longer block — increase scrollEnd distance for a slower reveal -->
  <p data-word-fade>
    A longer paragraph with more words will use the same scrub timing
    but spread across more of the page because there are more words
    in the timeline each taking an equal slice of the scroll distance.
  </p>
</template>

HOW THE SCRUB TIMING WORKS
  The total scroll distance between `scrollStart` and `scrollEnd` is
  divided equally between all words. So:

  - A 5-word sentence spreads its full reveal across that distance
  - A 30-word paragraph also spreads across the same distance
    (each word gets a shorter slice of scroll)

  If you want longer paragraphs to reveal more slowly, use a
  second composable instance with a taller scrollEnd:

  const slowFade = useWordFade({ scrollEnd: 'bottom -50%' })

  Or wrap long paragraphs in a taller container so ScrollTrigger
  has more physical scroll distance to work with.

SCRUB VALUES
  scrub: true   — animation is perfectly locked to scroll position
  scrub: 0.5    — 0.5s lag, feels slightly floaty
  scrub: 2      — 2s lag, very smooth/cinematic but slow to catch up

NOTE ON AUTO-IMPORTS:
  Nuxt 4 auto-imports everything in `composables/`. You never need to write
  `import { useWordFade } from '~/composables/useWordFade'`.

NOTE ON GSAP:
  Install via: npm install gsap
  SplitText and ScrollTrigger are now fully free — no Club license required.
──────────────────────────────────────────────────────────────────────
*/