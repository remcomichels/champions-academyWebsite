import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

// ─────────────────────────────────────────────────────────────────────────────
// useWordReveal
//
// Per-word reveal via SplitText — [data-words] animates on init, [data-scroll-words]
// on scroll, driving CSS-defined hidden word states to visible. Unsplit and
// fully visible under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WordRevealOptions {
  /**
   * Custom DOM event name that triggers initWords() once fonts are ready.
   * Fire it with: document.dispatchEvent(new Event('initPage'))
   * Default: 'initPage'.
   */
  triggerEvent?: string
  /**
   * ScrollTrigger `start` for [data-scroll-words] elements.
   * Default: '0% 90%'.
   */
  scrollStart?: string
  /**
   * GSAP tween duration per word, in seconds.
   * Default: 0.9.
   */
  duration?: number
  /**
   * Per-word stagger (seconds) when the element has no data-words-fast.
   * Default: 0.3.
   */
  delayNormal?: number
  /**
   * Per-word stagger (seconds) when the element has data-words-fast="true".
   * Default: 0.1.
   */
  delayFast?: number
}

interface UseWordRevealReturn {
  /** Split [data-words] (animate now) and wire ScrollTriggers for [data-scroll-words]. */
  initWords: () => void
  /** Animate the .word spans inside a single element — exposed for manual triggering. */
  animWords: (el: HTMLElement) => void
  /** Kill all ScrollTriggers and remove the trigger-event listener. */
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export function useWordReveal(
  options: WordRevealOptions = {}
): UseWordRevealReturn {
  const {
    triggerEvent = 'initPage',
    scrollStart  = '0% 90%',
    duration     = 0.9,
    delayNormal  = 0.3,
    delayFast    = 0.1,
  } = options

  const scrollTriggers: ScrollTrigger[] = []

  const { reduced } = useReducedMotion()

  // ─────────────────────────────────────────────────────────────────────────
  // animWords
  // ─────────────────────────────────────────────────────────────────────────

  function animWords(el: HTMLElement): void {
    const delay = el.dataset.wordsFast === 'true' ? delayFast : delayNormal

    const words = el.querySelectorAll<HTMLElement>('.word')

    words.forEach((word, i) => {
      gsap.to(word, {
        duration,
        y: 0,        // reset vertical offset set by your CSS
        rotate: 0,   // reset rotation set by your CSS
        opacity: 1,
        delay: delay * i, // each word staggers slightly after the last
        ease: 'power3.out',
        onComplete() {
          word.classList.add('transformNone')
        },
      })
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // initWords
  // ─────────────────────────────────────────────────────────────────────────

  function initWords(): void {
    // Reduced motion: leave the text unsplit and fully visible.
    if (reduced.value) return

    // ── Pass 1: [data-words] ──────────────────────────────────────────────
    const wordEls = document.querySelectorAll<HTMLElement>('[data-words]')

    if (wordEls.length > 0) {
      new SplitText(wordEls, {
        type: 'words',
        wordsClass: 'word',
      })
    }

    requestAnimationFrame(() => {
      wordEls.forEach((el) => {
        el.classList.add('active')
      })
    })

    // ── Pass 2: [data-scroll-words] ───────────────────────────────────────
    const scrollEls = document.querySelectorAll<HTMLElement>('[data-scroll-words]')

    scrollEls.forEach((el) => {
      const isDirect = el.dataset.scrollDirect === 'true'

      const trigger = ScrollTrigger.create({
        trigger: el,
        start: isDirect ? '0% 100%' : scrollStart,
        end:   isDirect ? '0% 100%' : '0 90%',
        onEnter() {
          animWords(el)
        },
      })

      scrollTriggers.push(trigger)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // destroy
  // ─────────────────────────────────────────────────────────────────────────

  function destroy(): void {
    scrollTriggers.forEach((st) => st.kill())
    scrollTriggers.length = 0

    document.removeEventListener(triggerEvent, initWords)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bootstrap
  // ─────────────────────────────────────────────────────────────────────────

  if (import.meta.client) {
    document.fonts.ready.then(() => {
      document.addEventListener(triggerEvent, initWords)
    })
  }

  return { initWords, animWords, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

Place this file in `composables/useWordReveal.ts` and Nuxt 4 will
auto-import it — no import statement needed in your .vue files.

<script setup lang="ts">
const { initWords, animWords, destroy } = useWordReveal({
  // All options are optional — shown here for clarity
  triggerEvent: 'initPage', // custom event name that calls initWords()
  scrollStart:  '0% 90%',  // ScrollTrigger start for normal scroll els
  duration:     0.9,        // GSAP tween duration per word (seconds)
  delayNormal:  0.3,        // per-word stagger when data-words-fast is absent
  delayFast:    0.1,        // per-word stagger when data-words-fast="true"
})

onMounted(() => {
  // Option A — call directly after mount
  initWords()

  // Option B — dispatch the custom event (mirrors the original jQuery pattern)
  // document.dispatchEvent(new Event('initPage'))
})

onUnmounted(() => {
  // Always call destroy() — kills ScrollTriggers and the event listener
  destroy()
})
</script>

<template>
  <!--
    ── Attributes for immediate word splitting [data-words] ───────────

    data-words
      Splits the element immediately on initWords() — no scroll trigger.
      Adds the "active" class before splitting so your CSS initial state
      is applied (e.g. opacity: 0, translateY, rotate on each .word span).

    ── Attributes for scroll-triggered word animation [data-scroll-words]

    data-scroll-words
      Splits + animates words when the element scrolls into view.
      Trigger fires at scrollStart (default "0% 90%").

    data-scroll-direct="true"
      Fires animWords() the moment the element's top edge hits the very
      bottom of the viewport (start: "0% 100%").
      Without this, animation fires at 90% viewport height.

    data-words-fast="true"
      Halves the per-word stagger delay (delayFast vs delayNormal).
      Useful for shorter words or less prominent text that should
      animate more crisply.
  -->

  <!-- Split and animate immediately on initWords() -->
  <h1 data-words>Hello World</h1>

  <!-- Animate on scroll — triggers when element top hits 90% of viewport -->
  <p data-scroll-words>Scroll triggered words</p>

  <!-- Animate on scroll — triggers at the very bottom of the viewport -->
  <p data-scroll-words data-scroll-direct="true">Direct scroll words</p>

  <!-- Animate on scroll with a faster per-word stagger -->
  <p data-scroll-words data-words-fast="true">Fast stagger words</p>

  <!-- All scroll attributes combined -->
  <h2 data-scroll-words data-scroll-direct="true" data-words-fast="true">
    Fast direct scroll
  </h2>
</template>

CSS SETUP (required)
  Your stylesheet needs to define the initial hidden state for words.
  The composable adds the "active" class and SplitText adds "word" to each
  word span, so target the combination:

  .active .word {
    display: inline-block;
    opacity: 0;
    transform: translateY(20px) rotate(5deg);
  }
  .transformNone {
    transform: none !important;
  }
──────────────────────────────────────────────────────────────────────
*/
