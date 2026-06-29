import type { Ref } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ─────────────────────────────────────────────────────────────────────────────
// useCountUp
//
// Animated number counting for stats, triggered once when the element scrolls
// into view. Target value and formatting come from data attributes. The final
// value is shown instantly under reduced motion (no count).
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CountUpOptions {
  /** Attribute marking elements to count. Default: 'data-count-up'. */
  attribute?: string
  /** Count duration in seconds. Default: 2. */
  duration?: number
  /** GSAP ease. Default: 'power2.out'. */
  ease?: string
  /** ScrollTrigger start (fires once on enter). Default: 'top 85%'. */
  scrollStart?: string
}

interface UseCountUpReturn {
  initCountUp: () => void
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

// Fixed decimals + thousands separators, with optional prefix/suffix.
function formatNumber(value: number, decimals: number, prefix: string, suffix: string): string {
  const fixed = value.toFixed(decimals)
  const [int, frac] = fixed.split('.')
  const sep = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${prefix}${frac ? `${sep}.${frac}` : sep}${suffix}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animated number counting for stats, triggered once when the element scrolls
 * into view. The target is the attribute value (or the element's text). Per
 * element: data-count-from, data-count-decimals, data-count-prefix,
 * data-count-suffix.
 *
 * Under reduced motion the final value is shown immediately (no count).
 *
 * @param root  Optional ref to scope the query to one component instance.
 */
export function useCountUp(
  root?: Ref<HTMLElement | null>,
  options: CountUpOptions = {},
): UseCountUpReturn {
  const {
    attribute = 'data-count-up',
    duration = 2,
    ease = 'power2.out',
    scrollStart = 'top 85%',
  } = options

  const triggers: ScrollTrigger[] = []
  const { reduced } = useReducedMotion()

  function initCountUp(): void {
    const scope: ParentNode = root?.value ?? document

    scope.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((el) => {
      if (el.dataset.countUpInitialized) return
      el.dataset.countUpInitialized = 'true'

      const targetRaw = el.getAttribute(attribute) || el.textContent || '0'
      const target = parseFloat(targetRaw.replace(/[^0-9.-]/g, '')) || 0
      const from = parseFloat(el.dataset.countFrom ?? '0') || 0
      const decimals = parseInt(el.dataset.countDecimals ?? '0', 10) || 0
      const prefix = el.dataset.countPrefix ?? ''
      const suffix = el.dataset.countSuffix ?? ''

      // Render the starting value immediately (final value under reduced motion).
      el.textContent = formatNumber(reduced.value ? target : from, decimals, prefix, suffix)
      if (reduced.value) return

      const proxy = { val: from }
      const tween = gsap.to(proxy, {
        val: target,
        duration,
        ease,
        scrollTrigger: { trigger: el, start: scrollStart, once: true },
        onUpdate() {
          el.textContent = formatNumber(proxy.val, decimals, prefix, suffix)
        },
        onComplete() {
          el.textContent = formatNumber(target, decimals, prefix, suffix)
        },
      })

      if (tween.scrollTrigger) triggers.push(tween.scrollTrigger)
    })
  }

  function destroy(): void {
    triggers.forEach((t) => t.kill())
    triggers.length = 0
  }

  return { initCountUp, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed.

<script setup lang="ts">
const root = useTemplateRef<HTMLElement>('root')
const { initCountUp, destroy } = useCountUp(root)
onMounted(() => initCountUp())
onUnmounted(() => destroy())
</script>

<template>
  <div ref="root">
    <span data-count-up="1280" data-count-suffix="+">0</span>
    <span data-count-up="99.9" data-count-decimals="1" data-count-suffix="%">0</span>
    <span data-count-up="2500000" data-count-prefix="$">0</span>
  </div>
</template>
──────────────────────────────────────────────────────────────────────
*/
