import { SplitText } from 'gsap/SplitText'
import gsap from 'gsap'

gsap.registerPlugin(SplitText)

// ─────────────────────────────────────────────────────────────────────────────
// useLineReveal
//
// Splits text into lines (SplitText) and toggles a class so your CSS transition
// reveals them line by line. Driven by the initPage event. Unsplit and fully
// visible under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LineRevealOptions {
  /**
   * Custom DOM event name that triggers initLines() once fonts are ready.
   * Fire it with: document.dispatchEvent(new Event('initPage'))
   * Default: 'initPage'.
   */
  triggerEvent?: string
  /**
   * Class applied by SplitText to each rendered line span — target it in CSS.
   * Default: 'splitChild'.
   */
  linesClass?: string
  /**
   * Class added to the element after splitting to trigger the CSS transition.
   * Default: 'active'.
   */
  inviewClass?: string
}

interface UseLineRevealReturn {
  /** Split every [data-lines] element into lines, then add `inviewClass` next frame. */
  initLines: () => void
  /** Remove the trigger-event listener. */
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export function useLineReveal(
  options: LineRevealOptions = {}
): UseLineRevealReturn {
  const {
    triggerEvent = 'initPage',
    linesClass   = 'splitChild',
    inviewClass  = 'active',
  } = options

  const { reduced } = useReducedMotion()

  // ─────────────────────────────────────────────────────────────────────────
  // initLines
  // ─────────────────────────────────────────────────────────────────────────

  function initLines(): void {
    // Reduced motion: leave the text unsplit and fully visible.
    if (reduced.value) return

    const targets = document.querySelectorAll<HTMLElement>('[data-lines]')

    if (targets.length === 0) return

    targets.forEach((el) => {
      new SplitText(el, {
        type: 'lines',
        linesClass,
      })
    })

    requestAnimationFrame(() => {
      targets.forEach((el) => {
        el.classList.add(inviewClass)
      })
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // destroy
  // ─────────────────────────────────────────────────────────────────────────

  function destroy(): void {
    document.removeEventListener(triggerEvent, initLines)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bootstrap
  // ─────────────────────────────────────────────────────────────────────────

  if (import.meta.client) {
    document.fonts.ready.then(() => {
      document.addEventListener(triggerEvent, initLines)
    })
  }

  return { initLines, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

Place this file in `composables/useLineReveal.ts` and Nuxt 4 will
auto-import it — no import statement needed in your .vue files.

<script setup lang="ts">
const { initLines, destroy } = useLineReveal({
  // All options are optional — shown here for clarity
  triggerEvent: 'initPage',   // custom event name that calls initLines()
  linesClass:   'splitChild', // class added to each split line span
  inviewClass:  'active',     // class added to the element to trigger CSS transition
})

onMounted(() => {
  // Option A — call directly after mount
  initLines()

  // Option B — dispatch the custom event (mirrors the original jQuery pattern)
  // document.dispatchEvent(new Event('initPage'))
})

onUnmounted(() => {
  // Always call destroy() to remove the event listener
  destroy()
})
</script>

<template>
  <!--
    data-lines
      Add this attribute to any element whose text should be split into lines.
      The composable splits the text into .splitChild spans, then adds the
      'active' class in the next animation frame so CSS transitions fire.

      The composable will wrap each rendered line in a span like:
        <span class="splitChild">Your line of text</span>

      Target .splitChild in your CSS transitions to drive the reveal.
  -->

  <h1 data-lines>This heading will be split into lines</h1>

  <p data-lines>
    This paragraph will also be split. Each line becomes
    an individually animatable span with the splitChild class.
  </p>
</template>

CSS SETUP (recommended)

  .my-element {
    .splitChild {
      display: block;
      opacity: 0;
      transform: translateY(101%);
      transition: transform 0.45s cubic-bezier(.6, 0, .2, 1),
                  opacity 0.45s cubic-bezier(.6, 0, .2, 1);
    }

    &.active {
      .splitChild {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }
──────────────────────────────────────────────────────────────────────
*/
