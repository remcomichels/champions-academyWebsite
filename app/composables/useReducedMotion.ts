import type { ComputedRef } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// useReducedMotion
//
// The single source of truth for the prefers-reduced-motion setting. Every
// animation composable checks `reduced` before doing any motion. Wraps VueUse's
// usePreferredReducedMotion (auto-imported via @vueuse/nuxt) so we don't
// hand-roll a media query — and it stays reactive if the OS setting changes.
//
// THE CONTRACT under reduced motion: still SHOW the content, only skip the
// motion. A composable must never leave anything hidden just because motion is
// off — reveal to the final state instantly instead. CSS-driven transitions are
// additionally neutralised by a global @media rule (see _general.less).
// ─────────────────────────────────────────────────────────────────────────────

interface UseReducedMotionReturn {
  /** True when the user has asked the OS/browser to minimise motion. */
  reduced: ComputedRef<boolean>
}

export function useReducedMotion(): UseReducedMotionReturn {
  const preference = usePreferredReducedMotion()
  const reduced = computed(() => preference.value === 'reduce')
  return { reduced }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed.

Inside an animation composable, bail (after revealing content) when motion is off:

  const { reduced } = useReducedMotion()

  function initSomething(): void {
    if (reduced.value) {
      // reveal everything to its final, visible state — no tweens, no triggers
      return
    }
    // …normal animated path…
  }
──────────────────────────────────────────────────────────────────────
*/
