import { gsap } from 'gsap'

// ─────────────────────────────────────────────────────────────────────────────
// useIntro
//
// First-load intro overlay. Slides the covering panel away on mount and sets
// `introComplete` (which un-gates the reveal composables) + fires `initPage`.
// Plays once per full page load, never on route changes; instant under reduced
// motion. Pair with usePageTransition for navigation.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface IntroOptions {
  /** CSS selector for the overlay element (rendered in app.vue). Default: '.intro'. */
  selector?: string
  /** How long the overlay holds before revealing, in seconds. Default: 0.3. */
  delay?: number
  /** Reveal (slide-away) duration in seconds. Default: 1. */
  duration?: number
  /** GSAP ease for the reveal. Default: 'power3.inOut'. */
  ease?: string
}

interface UseIntroReturn {
  /** Cut the intro short (e.g. a "skip" button): reveal now and mark it complete. */
  skip: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * First-load intro. The overlay is server-rendered so it covers the page from
 * the very first paint; on mount this slides it away and flips `introComplete`,
 * which is what un-gates the reveal composables (useInview, useLetterAnimation).
 *
 * Plays once per full page load — app.vue mounts a single time, and
 * `introComplete` persists across SPA navigations, so it never replays on
 * route changes (that's usePageTransition's job).
 *
 * Under reduced motion it reveals instantly with no animation.
 *
 * Call it once from app.vue. The overlay markup lives there too:
 *   <div class="intro" />
 */
export function useIntro(options: IntroOptions = {}): UseIntroReturn {
  const {
    selector = '.intro',
    delay = 0.3,
    duration = 1,
    ease = 'power3.inOut',
  } = options

  const introComplete = useState('introComplete', () => false)
  const { reduced } = useReducedMotion()

  let tween: gsap.core.Tween | null = null

  // Mark the intro done: flip the shared flag (introComplete watchers fire) and
  // dispatch initPage for the event-driven reveal composables.
  function finish(): void {
    if (introComplete.value) return
    introComplete.value = true
    document.dispatchEvent(new Event('initPage'))
  }

  function hide(el: HTMLElement | null): void {
    if (el) el.style.display = 'none'
  }

  function skip(): void {
    tween?.kill()
    hide(document.querySelector<HTMLElement>(selector))
    finish()
  }

  onMounted(() => {
    const el = document.querySelector<HTMLElement>(selector)

    // Already played (defensive: a rare re-mount) — just make sure it's hidden.
    if (introComplete.value) {
      hide(el)
      return
    }

    // No overlay or reduced motion: reveal instantly.
    if (!el || reduced.value) {
      hide(el)
      finish()
      return
    }

    // Hold briefly, then slide the covering overlay up to reveal the page.
    tween = gsap.to(el, {
      yPercent: -100,
      delay,
      duration,
      ease,
      onComplete() {
        hide(el)
        finish()
      },
    })
  })

  return { skip }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed. Call once in app.vue and render the
overlay alongside <NuxtLayout>:

<script setup lang="ts">
useState('introComplete', () => false)   // initialise early
useIntro()
</script>

<template>
  <div class="intro" />
  <NuxtLayout />
</template>

CSS (app/assets/less/components/transitions.less — already imported via main.less)
  The composable only animates `transform` (yPercent). Everything else — colour,
  a centred logo/counter, etc. — is yours. The overlay must cover from the first
  paint (full-screen, high z-index, no initial transform).

  .intro {
    .fixed(100vh, 100%, 0, 0);
    z-index: 9999;
    background-color: @black;
    // optionally place a logo/counter inside and animate it before the reveal
  }

NOTE
  Want a hold-then-counter intro? Run your own GSAP timeline on children first,
  then let this reveal fire — or raise `delay` to wait for it.
──────────────────────────────────────────────────────────────────────
*/
