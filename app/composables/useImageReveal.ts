import type { Ref } from 'vue'
import { gsap } from 'gsap'

// ─────────────────────────────────────────────────────────────────────────────
// useImageReveal
//
// Blur-up image reveal — an image starts blurred + slightly scaled and sharpens
// once it finishes loading (or immediately if cached). Pairs with AppImage,
// which reserves space so there's no layout shift. Shown as-is under reduced
// motion. For a scroll-triggered wipe instead, use useClipReveal.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ImageRevealOptions {
  /** Attribute marking elements to reveal. Default: 'data-image-reveal'. */
  attribute?: string
  /** Reveal duration in seconds. Default: 1.2. */
  duration?: number
  /** GSAP ease. Default: 'power2.out'. */
  ease?: string
  /** Starting blur in px. Default: 20. */
  blur?: number
  /** Starting scale (eases back to 1). Default: 1.1. */
  scale?: number
}

interface UseImageRevealReturn {
  initImageReveal: () => void
  destroy: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blur-up reveal: an image starts blurred + slightly scaled and sharpens once it
 * finishes loading (or immediately if cached). Pairs with AppImage, which sets
 * width/height so there's no layout shift while it loads.
 *
 * Put [data-image-reveal] on the <img>, or on a wrapper containing one.
 * Under reduced motion the image is shown as-is.
 *
 * @param root  Optional ref to scope the query to one component instance.
 */
export function useImageReveal(
  root?: Ref<HTMLElement | null>,
  options: ImageRevealOptions = {},
): UseImageRevealReturn {
  const {
    attribute = 'data-image-reveal',
    duration = 1.2,
    ease = 'power2.out',
    blur = 20,
    scale = 1.1,
  } = options

  const tweens: gsap.core.Tween[] = []
  const cleanups: Array<() => void> = []
  const { reduced } = useReducedMotion()

  function reveal(el: HTMLElement): void {
    const tween = gsap.fromTo(
      el,
      { filter: `blur(${blur}px)`, scale },
      {
        filter: 'blur(0px)',
        scale: 1,
        duration,
        ease,
        onComplete() { gsap.set(el, { clearProps: 'willChange' }) },
      },
    )
    tweens.push(tween)
  }

  function initImageReveal(): void {
    const scope: ParentNode = root?.value ?? document

    scope.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((el) => {
      if (el.dataset.imageRevealInitialized) return
      el.dataset.imageRevealInitialized = 'true'

      if (reduced.value) return // show as-is

      const img = (el.tagName === 'IMG' ? el : el.querySelector('img')) as HTMLImageElement | null
      const target: HTMLElement = img ?? el

      // Apply the hidden state up front so there's no flash before reveal.
      gsap.set(target, { filter: `blur(${blur}px)`, scale, willChange: 'filter, transform' })

      // Reveal on load, or right away if already complete / not an <img>.
      if (img && !img.complete) {
        const onLoad = () => reveal(target)
        img.addEventListener('load', onLoad, { once: true })
        cleanups.push(() => img.removeEventListener('load', onLoad))
      } else {
        reveal(target)
      }
    })
  }

  function destroy(): void {
    tweens.forEach((t) => t.kill())
    tweens.length = 0
    cleanups.forEach((fn) => fn())
    cleanups.length = 0
  }

  return { initImageReveal, destroy }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed.

<script setup lang="ts">
const root = useTemplateRef<HTMLElement>('root')
const { initImageReveal, destroy } = useImageReveal(root)
onMounted(() => initImageReveal())
onUnmounted(() => destroy())
</script>

<template>
  <div ref="root">
    <NuxtAppImage data-image-reveal src="..." alt="..." :width="1200" :height="800" />
  </div>
</template>

NOTE
  For a scroll-triggered wipe instead of an on-load blur-up, use useClipReveal.
──────────────────────────────────────────────────────────────────────
*/
