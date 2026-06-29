import type { Ref } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ─────────────────────────────────────────────────────────────────────────────
// useClipReveal
//
// Clip-path wipe reveal on scroll — the visual sibling of the line/word reveals.
// Each [data-clip-reveal] element wipes open from one edge (per-element
// direction) as it enters view. Shown unclipped immediately under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ClipDirection = 'up' | 'down' | 'left' | 'right'

interface ClipRevealOptions {
  /** Attribute marking elements to reveal. Default: 'data-clip-reveal'. */
  attribute?: string
  /** Reveal duration in seconds. Default: 1. */
  duration?: number
  /** GSAP ease. Default: 'power3.inOut'. */
  ease?: string
  /** ScrollTrigger start. Default: 'top 85%'. */
  scrollStart?: string
  /** Default reveal direction; per element override via data-clip-reveal="left". Default: 'up'. */
  direction?: ClipDirection
}

interface UseClipRevealReturn {
  initClipReveal: () => void
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

// Hidden start state per direction (inset: top right bottom left). Animating to
// inset(0) wipes the element open from that edge.
const FROM: Record<ClipDirection, string> = {
  up: 'inset(100% 0% 0% 0%)',
  down: 'inset(0% 0% 100% 0%)',
  left: 'inset(0% 100% 0% 0%)',
  right: 'inset(0% 0% 0% 100%)',
}
const TO = 'inset(0% 0% 0% 0%)'

/**
 * Clip-path wipe reveal on scroll — the visual sibling of the line/word reveals.
 * Each [data-clip-reveal] element wipes open from one edge as it enters view.
 * Set the edge per element with data-clip-reveal="left" (up/down/left/right).
 *
 * Under reduced motion elements are shown unclipped immediately.
 *
 * @param root  Optional ref to scope the query to one component instance.
 */
export function useClipReveal(
  root?: Ref<HTMLElement | null>,
  options: ClipRevealOptions = {},
): UseClipRevealReturn {
  const {
    attribute = 'data-clip-reveal',
    duration = 1,
    ease = 'power3.inOut',
    scrollStart = 'top 85%',
    direction = 'up',
  } = options

  const triggers: ScrollTrigger[] = []
  const { reduced } = useReducedMotion()

  function initClipReveal(): void {
    const scope: ParentNode = root?.value ?? document

    scope.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((el) => {
      if (el.dataset.clipRevealInitialized) return
      el.dataset.clipRevealInitialized = 'true'

      // Reduced motion: just show it.
      if (reduced.value) {
        gsap.set(el, { clipPath: 'none' })
        return
      }

      const dir = (el.getAttribute(attribute) || direction) as ClipDirection
      const from = FROM[dir] ?? FROM[direction]

      const tween = gsap.fromTo(
        el,
        { clipPath: from },
        {
          clipPath: TO,
          duration,
          ease,
          scrollTrigger: { trigger: el, start: scrollStart, once: true },
        },
      )

      if (tween.scrollTrigger) triggers.push(tween.scrollTrigger)
    })
  }

  function destroy(): void {
    triggers.forEach((t) => t.kill())
    triggers.length = 0
  }

  return { initClipReveal, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed.

<script setup lang="ts">
const root = useTemplateRef<HTMLElement>('root')
const { initClipReveal, destroy } = useClipReveal(root)
onMounted(() => initClipReveal())
onUnmounted(() => destroy())
</script>

<template>
  <div ref="root">
    <h2 data-clip-reveal>Wipes up into view</h2>
    <img data-clip-reveal="left" src="..." alt="...">  <!-- wipes from the left -->
  </div>
</template>
──────────────────────────────────────────────────────────────────────
*/
