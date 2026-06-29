import type { Ref } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register once at module level — safe to call repeatedly.
gsap.registerPlugin(ScrollTrigger)

// ─────────────────────────────────────────────────────────────────────────────
// useScrollProgress
//
// Reactive scroll progress (0 → 1) for the whole page or a single element.
// Drives reading-progress bars, circular indicators, nav active-states and
// scroll dots. Not gated on reduced motion — it's a reading, not decoration.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScrollProgressOptions {
  /**
   * Element to measure. Omit for whole-page progress (0 at the very top of the
   * document, 1 at the very bottom).
   */
  target?: Ref<HTMLElement | null>
  /**
   * ScrollTrigger `start` (element mode only). Where progress hits 0.
   * Default: 'top bottom' (element's top reaches the viewport bottom).
   */
  start?: string
  /**
   * ScrollTrigger `end` (element mode only). Where progress hits 1.
   * Default: 'bottom top' (element's bottom reaches the viewport top).
   */
  end?: string
}

interface UseScrollProgressReturn {
  /** Reactive scroll progress, 0 → 1. Read-only output. */
  progress: Ref<number>
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reactive scroll progress (0 → 1) for the whole page or a single element. Feed
 * it into a progress bar, a circular indicator, a nav active-state, scroll-snap
 * dots, etc.
 *
 * NOT gated on reduced motion: progress is a direct reading of scroll position,
 * not decorative motion — a reading-progress bar must keep working. If you use
 * it to drive decorative motion, gate that consumer with useReducedMotion.
 */
export function useScrollProgress(
  options: ScrollProgressOptions = {},
): UseScrollProgressReturn {
  const { target, start = 'top bottom', end = 'bottom top' } = options

  const progress = ref(0)

  onMounted(() => {
    const el = target?.value ?? null

    const st = ScrollTrigger.create({
      // Page mode tracks the document element top→bottom; element mode tracks
      // the given element through the viewport using start/end.
      trigger: el ?? document.documentElement,
      start: el ? start : 'top top',
      end: el ? end : 'bottom bottom',
      onUpdate: (self) => { progress.value = self.progress },
      // Keep the value correct after layout changes (resize, font load, …).
      onRefresh: (self) => { progress.value = self.progress },
    })

    onBeforeUnmount(() => st.kill())
  })

  return { progress }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed.

PAGE READING-PROGRESS BAR

<script setup lang="ts">
const { progress } = useScrollProgress()
</script>

<template>
  <div class="readbar" :style="{ transform: `scaleX(${progress})` }" />
</template>

  .readbar {
    position: fixed; inset: 0 0 auto 0; height: 3px;
    background: @primary; transform-origin: left; z-index: 50;
  }

ELEMENT PROGRESS (e.g. pin a value to one section)

<script setup lang="ts">
const section = useTemplateRef<HTMLElement>('section')
const { progress } = useScrollProgress({ target: section, start: 'top center', end: 'bottom center' })
</script>

<template>
  <section ref="section">…</section>
</template>
──────────────────────────────────────────────────────────────────────
*/
