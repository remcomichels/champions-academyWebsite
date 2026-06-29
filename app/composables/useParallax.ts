import type { Ref } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register once at module level — safe to call repeatedly.
gsap.registerPlugin(ScrollTrigger)

// ─────────────────────────────────────────────────────────────────────────────
// useParallax
//
// Tiny vertical image parallax — upscales the image just enough that its scroll
// drift can never reveal a blank edge inside its overflow-hidden frame, so the
// frame stays put while the image glides. Skipped under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ParallaxOptions {
  /** Attribute that marks elements to parallax. Default: 'data-parallax'. */
  attribute?: string
  /**
   * Vertical travel in % of the element's own height, applied to EACH direction.
   * The element moves from +amount (shifted down) to -amount (shifted up) as it
   * scrolls through the viewport. Default: 5. A per-element value can override
   * this via the attribute, e.g. data-parallax="8".
   */
  amount?: number
  /**
   * Safety multiplier between the upscale slack and the travel distance.
   * The element is scaled up so the overflow on each side is `amount * safety`,
   * which (with safety > 1) guarantees the translate never exposes a blank edge.
   * Default: 1.6.
   */
  safety?: number
  /** ScrollTrigger scrub. true = locked to scroll, number = seconds of smoothing. Default: true. */
  scrub?: boolean | number
}

interface UseParallaxReturn {
  /** Scan for [data-parallax] elements (within `root` if given) and wire them up. */
  initParallax: () => void
  /** Kill every ScrollTrigger this instance created and clear inline transforms. */
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tiny vertical image parallax. The element is upscaled just enough that the
 * vertical translate can never reveal blank space inside its (overflow-hidden)
 * frame — so the frame stays put while the image drifts a little as you scroll.
 *
 * @param root  Optional ref to scope the DOM query to one component instance.
 */
export function useParallax(
  root?: Ref<HTMLElement | null>,
  options: ParallaxOptions = {},
): UseParallaxReturn {
  const {
    attribute = 'data-parallax',
    amount = 5,
    safety = 1.6,
    scrub = true,
  } = options

  const triggers: ScrollTrigger[] = []
  const tweens: gsap.core.Tween[] = []

  const { reduced } = useReducedMotion()

  function initParallax(): void {
    // Respect users who asked for less motion — leave the image untouched.
    if (reduced.value) return

    const scope: ParentNode = root?.value ?? document
    scope.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((el) => {
      if (el.dataset.parallaxInitialized) return
      el.dataset.parallaxInitialized = 'true'

      // Per-element override: data-parallax="8" → 8% travel.
      const override = parseFloat(el.getAttribute(attribute) || '')
      const travel = Number.isFinite(override) && override > 0 ? override : amount

      // Upscale so each side overflows by `travel * safety` percent of height.
      // slack(each side) = (scale - 1) / 2  →  scale = 1 + 2 * (travel * safety) / 100
      const scale = 1 + (2 * travel * safety) / 100

      // GSAP owns the full transform (scale + translate) so they compose cleanly.
      gsap.set(el, { scale, transformOrigin: 'center center', willChange: 'transform' })

      // Trigger off the (untransformed) parent frame for stable start/end measurement.
      const trigger = el.parentElement ?? el

      const tween = gsap.fromTo(
        el,
        { yPercent: travel },
        {
          yPercent: -travel,
          ease: 'none', // linear → tracks scroll 1:1
          scrollTrigger: {
            trigger,
            start: 'top bottom',
            end: 'bottom top',
            scrub,
          },
        },
      )

      tweens.push(tween)
      if (tween.scrollTrigger) triggers.push(tween.scrollTrigger)
    })
  }

  function destroy(): void {
    triggers.forEach((t) => t.kill())
    triggers.length = 0
    tweens.forEach((t) => {
      const el = t.targets()[0] as HTMLElement | undefined
      t.kill()
      if (el) {
        gsap.set(el, { clearProps: 'transform,willChange' })
        delete el.dataset.parallaxInitialized
      }
    })
    tweens.length = 0
  }

  return { initParallax, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

This file lives in `composables/` so Nuxt 4 auto-imports it — no import
statement needed.

The parallaxed element is upscaled just enough that its vertical drift can
never reveal a blank edge inside its (overflow-hidden) frame. So the frame
stays put while the image glides as you scroll. Skipped under
prefers-reduced-motion.

<script setup lang="ts">
// Pass a root ref so destroy() only touches this instance's elements.
const root = useTemplateRef<HTMLElement>('root')
const { initParallax, destroy } = useParallax(root, {
  // All options are optional — shown here for clarity
  attribute: 'data-parallax', // marks elements to parallax
  amount:    5,               // vertical travel as % of the element's height
  safety:    1.6,             // upscale slack vs travel (>1 avoids blank edges)
  scrub:     true,            // true = locked to scroll, number = seconds of smoothing
})

onMounted(() => initParallax())
onUnmounted(() => destroy())   // kills the ScrollTriggers and clears transforms
</script>

<template>
  <div ref="root">
    <!-- The frame clips; the image inside drifts. Default 5% travel. -->
    <figure class="frame">
      <NuxtAppImage data-parallax src="..." alt="..." />
    </figure>

    <!-- Per-element override: 8% travel -->
    <figure class="frame">
      <NuxtAppImage data-parallax="8" src="..." alt="..." />
    </figure>
  </div>
</template>

CSS SETUP (required)
  The frame must clip overflow; the image fills it. The composable owns the
  image's transform (scale + translate), so don't set transform on it yourself.

  .frame {
    overflow: hidden;
    position: relative;
  }
  .frame > * {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
──────────────────────────────────────────────────────────────────────
*/
