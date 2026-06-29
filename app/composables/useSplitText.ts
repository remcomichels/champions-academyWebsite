import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

// ─────────────────────────────────────────────────────────────────────────────
// useSplitText
//
// Shared GSAP SplitText wrapper — centralises plugin registration and the
// line/word/char class names, and tracks every split so a single revert()
// restores the DOM. Build new text-animation composables on top of this rather
// than calling `new SplitText` directly.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SplitOptions {
  /** What to split into. Default: 'lines,words,chars'. */
  type?: string
  /** Class applied to each line. Default: 'line'. */
  linesClass?: string
  /** Class applied to each word. Default: 'word'. */
  wordsClass?: string
  /** Class applied to each character. Default: 'char'. */
  charsClass?: string
}

interface UseSplitTextReturn {
  /** Split an element and return the SplitText (access .lines/.words/.chars). Tracked for revert(). */
  split: (el: HTMLElement, options?: SplitOptions) => SplitText
  /** Revert every split this instance made, restoring the original DOM. Call in onUnmounted. */
  revert: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thin, shared wrapper around GSAP SplitText. Centralises plugin registration
 * and the line/word/char class names, and tracks every split so a single
 * revert() cleans them all up (important — SplitText leaves wrapper spans in the
 * DOM otherwise). Build new text-animation composables on top of this rather
 * than calling `new SplitText` directly.
 */
export function useSplitText(): UseSplitTextReturn {
  const splits: SplitText[] = []

  function split(el: HTMLElement, options: SplitOptions = {}): SplitText {
    const instance = new SplitText(el, {
      type: options.type ?? 'lines,words,chars',
      linesClass: options.linesClass ?? 'line',
      wordsClass: options.wordsClass ?? 'word',
      charsClass: options.charsClass ?? 'char',
    })
    splits.push(instance)
    return instance
  }

  function revert(): void {
    splits.forEach((s) => s.revert())
    splits.length = 0
  }

  return { split, revert }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed. Wait for fonts before splitting so
line breaks are measured correctly.

<script setup lang="ts">
const el = useTemplateRef<HTMLElement>('el')
const { split, revert } = useSplitText()

onMounted(async () => {
  await document.fonts.ready
  const { chars } = split(el.value!, { type: 'chars' })
  gsap.from(chars, { yPercent: 100, stagger: 0.02, ease: 'power3.out' })
})
onUnmounted(() => revert())   // restores the original markup
</script>
──────────────────────────────────────────────────────────────────────
*/
