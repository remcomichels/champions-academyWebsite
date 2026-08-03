import type { Ref } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ─────────────────────────────────────────────────────────────────────────────
// useCardDeck
//
// Scroll-driven stacked card deck. Pins the section and, as you scroll, the
// top card slides up and tilts away revealing the next card underneath, while
// the cards behind step one position up the stack. Scrubbed + snapped per
// card, so you never rest mid-transition. Optionally drives line-indicator
// fills ([data-deck-line-fill]) and exposes a reactive `activeIndex` for
// counters. Under reduced motion (or with fewer than 2 cards) the section
// gets a `deck-static` class and cards render in normal flow — no pin.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CardDeckOptions {
  /** Selector for the cards inside `root`. Default: '[data-deck-card]'. */
  cardSelector?: string
  /** Selector for the indicator line fills. Default: '[data-deck-line-fill]'. */
  fillSelector?: string
  /** Scroll distance per card transition, in viewport heights. Default: 0.85. */
  distance?: number
  /** How many cards remain visible behind the active one. Default: 2. */
  maxVisible?: number
  /** Scale lost per depth step in the stack. Default: 0.05. */
  depthScale?: number
  /** yPercent shift per depth step (negative peeks above). Default: -5. */
  depthShift?: number
  /** Z-rotation (deg) of the leaving card; alternates sign per card. Default: 8. */
  exitRotation?: number
}

interface UseCardDeckReturn {
  initDeck: () => void
  destroy: () => void
  /** Index of the card currently on top of the deck. */
  activeIndex: Ref<number>
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export function useCardDeck(
  root: Ref<HTMLElement | null>,
  options: CardDeckOptions = {},
): UseCardDeckReturn {
  const {
    cardSelector = '[data-deck-card]',
    fillSelector = '[data-deck-line-fill]',
    distance = 0.85,
    maxVisible = 2,
    depthScale = 0.05,
    depthShift = -5,
    exitRotation = 8,
  } = options

  const activeIndex = ref(0)
  const { reduced } = useReducedMotion()

  let tl: gsap.core.Timeline | null = null

  // Deck position (scale / y / visibility) for a card at `depth` behind the top.
  function stackProps(depth: number): gsap.TweenVars {
    const clamped = Math.min(depth, maxVisible)
    return {
      scale: 1 - clamped * depthScale,
      yPercent: clamped * depthShift,
      autoAlpha: depth > maxVisible ? 0 : 1,
    }
  }

  function initDeck(): void {
    const section = root.value
    if (!section) return

    const cards = Array.from(section.querySelectorAll<HTMLElement>(cardSelector))
    const fills = Array.from(section.querySelectorAll<HTMLElement>(fillSelector))

    // Reduced motion / nothing to slide: render everything in normal flow.
    if (reduced.value || cards.length < 2) {
      section.classList.add('deck-static')
      return
    }

    const last = cards.length - 1

    // Initial deck: first card on top, the rest stacked behind it.
    cards.forEach((card, i) => {
      gsap.set(card, { zIndex: cards.length - i, ...stackProps(i) })
    })
    if (fills[0]) gsap.set(fills[0], { scaleX: 1, transformOrigin: 'left center' })

    tl = gsap.timeline({
      defaults: { ease: 'none', duration: 1 },
      scrollTrigger: {
        trigger: section,
        // Centre the deck itself, not the section. Centring the whole block
        // works while it fits the viewport, but stacked it can outgrow the
        // screen (893px at 600x800) and the fallback pinned from the top, which
        // pushed the deck — last in the stack — clean past the fold. Anchoring
        // on the deck's midpoint keeps the cards framed at any section height.
        //
        // While the whole section fits, centring it frames heading, indicator
        // and deck together with nothing lost, so that wins. Only once it
        // outgrows the screen do the two compete — and there the deck is what
        // has to stay framed, so the heading is allowed to scroll up.
        start: () => {
          const deck = cards[0]?.parentElement
          if (!deck || section.offsetHeight < window.innerHeight) return 'center center'
          const deckRect = deck.getBoundingClientRect()
          const offset = deckRect.top - section.getBoundingClientRect().top + deckRect.height / 2
          return `top+=${offset} center`
        },
        end: () => `+=${last * window.innerHeight * distance}`,
        pin: true,
        anticipatePin: 1,
        scrub: true,
        snap: {
          snapTo: 1 / last,
          duration: { min: 0.2, max: 0.6 },
          ease: 'power2.inOut',
          // Snap to the closest card (50/50), not in the scroll direction or
          // where velocity projects — a card barely peeked at settles back.
          directional: false,
          inertia: false,
        },
        onUpdate(self) {
          const index = Math.round(self.progress * last)
          if (index !== activeIndex.value) activeIndex.value = index
        },
      },
    })

    // One timeline segment per transition — segment i flips card i away.
    cards.forEach((card, i) => {
      if (i === last) return

      tl!.to(card, {
        yPercent: -120,
        rotation: i % 2 === 0 ? -exitRotation : exitRotation,
        ease: 'power1.in',
      }, i)

      // Fade the leaving card out over the back half of its flight so it never
      // lingers over the content above the pinned section.
      tl!.to(card, { autoAlpha: 0, duration: 0.5, ease: 'none' }, i + 0.5)

      // Every card behind it steps one position up the stack.
      for (let j = i + 1; j < cards.length; j++) {
        const behind = cards[j]
        if (behind) tl!.to(behind, { ...stackProps(j - i - 1), ease: 'power1.out' }, i)
      }

      // Indicator: drain the current line toward the next, fill the next one.
      const fillCurrent = fills[i]
      const fillNext = fills[i + 1]
      if (fillCurrent) tl!.to(fillCurrent, { scaleX: 0, transformOrigin: 'right center' }, i)
      if (fillNext) tl!.to(fillNext, { scaleX: 1, transformOrigin: 'left center' }, i)
    })
  }

  function destroy(): void {
    tl?.scrollTrigger?.kill()
    tl?.kill()
    tl = null
  }

  return { initDeck, destroy, activeIndex }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed.

<script setup lang="ts">
const root = useTemplateRef<HTMLElement>('root')
const { initDeck, destroy, activeIndex } = useCardDeck(root)
onMounted(() => initDeck())
onUnmounted(() => destroy())
</script>

<template>
  <section ref="root">
    <!-- one line per card; fills are scrubbed by the deck -->
    <span class="line"><span class="fill" data-deck-line-fill /></span>

    <div class="cards">
      <article data-deck-card>Card one</article>
      <article data-deck-card>Card two</article>
    </div>
  </section>
</template>

The cards container must be `position: relative` with an explicit
height/aspect-ratio, and the cards absolutely stacked inside it. Style
the `deck-static` fallback (reduced motion / single card) so cards
render stacked vertically in normal flow.
──────────────────────────────────────────────────────────────────────
*/
