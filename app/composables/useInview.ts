// ─────────────────────────────────────────────────────────────────────────────
// useInview
//
// Lightweight, CSS-driven scroll reveal — toggles a class when an element enters
// view (IntersectionObserver, no GSAP), gated on the intro/transition state.
// Reveals everything immediately under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface InviewOptions {
  /**
   * ScrollTrigger-style start string (e.g. '0% 90%') describing how far into the
   * viewport an element must scroll before it's considered in view. It's
   * converted to an IntersectionObserver rootMargin internally.
   * Default: '0% 90%' (fires when the element reaches 90% of viewport height).
   */
  scrollStart?: string
  /**
   * Class added to each element once it enters view. Target it in CSS to drive
   * the reveal transition.
   * Default: 'inView'.
   */
  inviewClass?: string
}

interface UseInviewReturn {
  /** Call from onMounted. Adds classes now if the page is ready, else waits for it. */
  initInview: () => void
  /** Scan all [data-scroll-inview] elements and add `inviewClass` when they're in view. */
  addInviewClasses: () => void
  /** Disconnect every IntersectionObserver this instance created. */
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Returns the element's top offset relative to the document (ignoring CSS transforms).
// Used as a fallback to detect elements that are in the viewport by layout position
// but whose visual position is shifted out of the intersection zone by a CSS transform.
function getLayoutTop(el: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = el
  while (node) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return top
}

// Converts a ScrollTrigger-style start string like '0% 90%' to an
// IntersectionObserver rootMargin bottom offset, e.g. '0px 0px -10% 0px'.
// IO callbacks fire *after* paint (unlike GSAP which fires synchronously),
// which is what makes CSS transitions work for immediately-visible elements.
function toRootMargin(scrollStart: string): string {
  const match = scrollStart.match(/\d+%\s+(\d+)%/)
  if (match) {
    const offset = 100 - parseInt(match[1]!, 10)
    return offset > 0 ? `0px 0px -${offset}% 0px` : '0px 0px 0px 0px'
  }
  return '0px 0px -10% 0px'
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export function useInview(options: InviewOptions = {}): UseInviewReturn {
  const {
    scrollStart = '0% 90%',
    inviewClass = 'inView',
  } = options

  const observers: IntersectionObserver[] = []
  const { reduced } = useReducedMotion()

  // ─────────────────────────────────────────────────────────────────────────
  // addInviewClasses
  // ─────────────────────────────────────────────────────────────────────────

  function addInviewClasses(): void {
    // Reduced motion: reveal everything immediately, skip the observers entirely.
    if (reduced.value) {
      document.querySelectorAll<HTMLElement>('[data-scroll-inview]').forEach((el) => {
        el.classList.add(inviewClass)
      })
      return
    }

    const scrollY = window.scrollY
    const vh = window.innerHeight

    document.querySelectorAll<HTMLElement>('[data-scroll-inview]').forEach((el) => {
      if (el.classList.contains(inviewClass)) return

      const isDirect = el.dataset.scrollDirect === 'true'

      // Fallback: if the element is in the viewport by layout position (ignoring CSS
      // transforms), add inView immediately. This prevents a deadlock where a transform
      // like translateY(100%) shifts the element's visual bounds just outside the
      // IntersectionObserver's rootMargin, so the callback never fires.
      const triggerLine = isDirect ? vh : vh * 0.9
      const layoutTop = getLayoutTop(el) - scrollY
      if (layoutTop < triggerLine && layoutTop + el.offsetHeight > 0) {
        el.classList.add(inviewClass)
        return
      }

      const rootMargin = isDirect ? '0px 0px 0px 0px' : toRootMargin(scrollStart)

      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add(inviewClass)
            obs.unobserve(el)
          }
        })
      }, { rootMargin, threshold: 0 })

      observer.observe(el)
      observers.push(observer)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // initInview  — call from onMounted; waits for intro/transition to finish
  // ─────────────────────────────────────────────────────────────────────────

  function initInview(): void {
    if (introComplete.value && !pageTransitioning.value) {
      addInviewClasses()
    }
    // If not ready yet, the watchers below will fire addInviewClasses()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // destroy
  // ─────────────────────────────────────────────────────────────────────────

  function destroy(): void {
    observers.forEach((obs) => obs.disconnect())
    observers.length = 0
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bootstrap
  // ─────────────────────────────────────────────────────────────────────────

  const introComplete     = useState('introComplete', () => false)
  const pageTransitioning = useState('pageTransitioning', () => false)

  if (import.meta.client) {
    // ── Initial load: run once intro overlay is gone ───────────────────────────
    watch(introComplete, (val) => {
      if (val) nextTick(() => addInviewClasses())
    })

    // ── Page transitions: run once overlay has slid away ──────────────────────
    watch(pageTransitioning, (val) => {
      if (!val && introComplete.value) nextTick(() => addInviewClasses())
    })

    // ── Re-check on resize (new elements may enter viewport) ──────────────────
    let currentWidth = window.innerWidth
    window.addEventListener('resize', () => {
      const newWidth = window.innerWidth
      if (newWidth !== currentWidth) {
        currentWidth = newWidth
        addInviewClasses()
      }
    }, { passive: true })
  }

  return { initInview, addInviewClasses, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

This file lives in `composables/` so Nuxt 4 auto-imports it — no import
statement needed.

This is the lightweight, CSS-driven reveal: it only toggles a class when an
element scrolls into view (via IntersectionObserver). The actual animation is
your CSS transition — no GSAP involved. Animations are gated on the shared
intro/transition state, so nothing reveals until the intro overlay is gone.

<script setup lang="ts">
const { initInview, destroy } = useInview({
  // All options are optional — shown here for clarity
  scrollStart: '0% 90%', // how far into the viewport before revealing
  inviewClass: 'inView', // class added when the element enters view
})

onMounted(() => initInview())
onUnmounted(() => destroy())   // always disconnect the observers
</script>

<template>
  <!-- Revealed at 90% of viewport height (the default trigger line) -->
  <section data-scroll-inview>Fades up on scroll</section>

  <!-- Revealed only once the element's top reaches the very bottom edge -->
  <section data-scroll-inview data-scroll-direct="true">Direct trigger</section>
</template>

CSS SETUP (required)
  Define the hidden state on the element and the visible state under the
  inviewClass. The transition is entirely yours:

  [data-scroll-inview] {
    opacity: 0;
    transform: translateY(40px);
    transition: opacity 0.6s @ease, transform 0.6s @ease;
  }
  [data-scroll-inview].inView {
    opacity: 1;
    transform: none;
  }
──────────────────────────────────────────────────────────────────────
*/
