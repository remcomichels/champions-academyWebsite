import { onMounted, onBeforeUnmount } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ─────────────────────────────────────────────────────────────────────────────
// useStackingCards
//
// Stacking cards — pins each card and, as you scroll past it, recedes it
// (scale + 3D tilt + alternating twist) while fading it out, so the cards pile
// up on top of one another. The last [data-stack-card] is the resting
// destination and is never animated. Driven by ScrollTrigger (the shared
// gsap.ticker). Under reduced motion the cards render normally — no stacking.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export function useStackingCards(): void {
  const { reduced } = useReducedMotion()

  let ctx: gsap.Context | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // onBeforeUnmount
  // ─────────────────────────────────────────────────────────────────────────

  onBeforeUnmount(() => {
    ctx?.revert()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // onMounted
  // ─────────────────────────────────────────────────────────────────────────

  onMounted(() => {
    // Reduced motion: skip pinning/animation — cards render normally in flow.
    if (reduced.value) return

    ctx = gsap.context(() => {

      // ── Find all stacking sections ───────────────────────────────────────
      const sections = document.querySelectorAll<HTMLElement>('[data-stacking]')

      sections.forEach(section => {

        // ── Find all cards within this section ─────────────────────────────
        const slides = section.querySelectorAll<HTMLElement>('[data-stack-card]')

        // ── Read config from data attributes ──────────────────────────────
        const start = section.dataset.stackStart ?? 'top top'
        const distance = Number(section.dataset.stackDistance ?? 1)
        const scale = Number(section.dataset.stackScale ?? 0.85)
        const rotateX = Number(section.dataset.stackRotateX ?? 35)
        const rotateZ = Number(section.dataset.stackRotateZ ?? 6)
        const fadeAt = Number(section.dataset.stackFade ?? 0.75)

        // ── Animate each card ──────────────────────────────────────────────
        slides.forEach((slide, index) => {

          const isLast = index === slides.length - 1
          if (isLast) return

          const wrapper = slide.querySelector<HTMLElement>('[data-stack-pin]')
          const content = slide.querySelector<HTMLElement>('[data-stack-content]')

          if (!wrapper || !content) return

          const pinDistance = window.innerHeight * distance

          // ── Tween 1: scale + rotation ────────────────────────────────────
          gsap.to(content, {
            scale,
            rotationX: rotateX,
            rotationZ: rotateZ * (index % 2 === 0 ? 1 : -1), // alternate twist direction
            ease: 'none',
            scrollTrigger: {
              trigger: slide,
              start,
              end: `+=${pinDistance}`,
              scrub: true,
              pin: wrapper,
              pinSpacing: false
            }
          })

          // ── Tween 2: fade out ────────────────────────────────────────────
          gsap.to(content, {
            autoAlpha: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: slide,
              start: `top+=${pinDistance * fadeAt} top`, // begin fade at fadeAt% of travel
              end:   `top+=${pinDistance} top`,           // fully faded at end of travel
              scrub: true
            }
          })
        })
      })
    })
  })
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

Place this file in `composables/useStackingCards.ts` and Nuxt 4 will
auto-import it — no import statement needed in your .vue files.

REQUIRED HTML STRUCTURE
Each stacking group needs this four-level nesting:

  [data-stacking]          ← section wrapper, holds config attributes
    [data-stack-card]      ← one card (repeat for each card in the stack)
      [data-stack-pin]     ← pinned by ScrollTrigger (wraps the visual card)
        [data-stack-content] ← receives scale / rotation / fade transforms

The LAST [data-stack-card] is never animated — it acts as the final
resting card that the others stack on top of as they recede.

<script setup lang="ts">
useStackingCards()
</script>

<template>
  <!--
    ── Attributes on the section wrapper [data-stacking] ──────────────

    data-stack-start="top top"
      ScrollTrigger `start` value for the pin.
      Accepts any valid GSAP scroll position string.
      Default: "top top"

    data-stack-distance="1"
      Multiplier of viewport height that determines how long each card
      is pinned. 1 = 100vh, 1.5 = 150vh, etc.
      Larger values slow down the stacking effect.
      Default: 1

    data-stack-scale="0.85"
      Target scale the card shrinks to as it stacks behind the next.
      Default: 0.85

    data-stack-rotateX="35"
      X-axis rotation (deg) applied as the card stacks — tilts it away.
      Default: 35

    data-stack-rotateZ="6"
      Z-axis rotation (deg) applied as the card stacks — adds a twist.
      Alternates sign per card so consecutive cards fan in opposite directions.
      Default: 6

    data-stack-fade="0.75"
      Progress point (0–1) within the pin distance where the fade begins.
      0.75 means the card starts fading at 75% of its scroll travel.
      Default: 0.75
  -->

  <section
    data-stacking
    data-stack-start="top top"
    data-stack-distance="1"
    data-stack-scale="0.85"
    data-stack-rotateX="35"
    data-stack-rotateZ="6"
    data-stack-fade="0.75"
  >
    <!-- Card 1 — animates (scale + rotate + fade) -->
    <div data-stack-card>
      <div data-stack-pin>
        <div data-stack-content>
          <p>Card One</p>
        </div>
      </div>
    </div>

    <!-- Card 2 — animates (scale + rotate + fade) -->
    <div data-stack-card>
      <div data-stack-pin>
        <div data-stack-content>
          <p>Card Two</p>
        </div>
      </div>
    </div>

    <!-- Card 3 — LAST card, never animated, acts as the final destination -->
    <div data-stack-card>
      <div data-stack-pin>
        <div data-stack-content>
          <p>Card Three</p>
        </div>
      </div>
    </div>
  </section>
</template>
──────────────────────────────────────────────────────────────────────
*/
