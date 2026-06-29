---
name: animation-patterns
description: >
  Enforces every animation convention for this Nuxt 4 boilerplate. Use this skill any time you
  are writing GSAP animations, adding ScrollTrigger, working with Lenis, implementing scroll-based
  effects, creating text reveal animations, adding entrance animations, wiring up magnetic or hover
  effects, creating a marquee, dispatching the initPage event, working with introComplete or
  pageTransitioning state, or writing any composable that uses gsap/ScrollTrigger/SplitText. Also
  fire when the user says "animate this", "add a scroll animation", "reveal text on scroll",
  "letter by letter", "word reveal", "fade in on scroll", "marquee", "smooth scroll", "add an
  entrance animation", "page transition", or any phrasing that involves motion, timing, or GSAP.
  CRITICAL rules baked in: (1) Always call destroy() in onUnmounted — leaks accumulate silently
  across SPA navigations with no error. (2) Composables import gsap directly — NOT via $gsap —
  $gsap is undefined in SSR contexts. (3) Gate animations on introComplete + pageTransitioning
  state — never fire blind on mount. (4) Never access document/window outside import.meta.client.
---

# Animation Patterns

All animation in this boilerplate goes through GSAP + ScrollTrigger, with Lenis for smooth scroll.
The patterns here are specific to this setup — generic GSAP knowledge will miss the state gating,
the import rules, and the cleanup contracts. Read this before writing any animation code.

---

## 1. What the plugins provide

Three client-only plugins run before any component mounts:

**`app/plugins/gsap.client.ts`** — registers ScrollTrigger, sets `gsap.defaults({ ease: 'power3.out' })`, and provides:
- `$gsap` — the gsap instance
- `$ScrollTrigger` — the ScrollTrigger class

**`app/plugins/lenis.client.ts`** — creates a Lenis instance with `lerp: 0.1` running its own
`requestAnimationFrame` loop (not synced via `scrollerProxy`), and provides:
- `$lenis` — the Lenis instance

**`app/plugins/main.client.ts`** — runs `initGlobalInteractions()` on load and after every
`page:finish` hook (via `requestAnimationFrame`).

SplitText is **not** registered in the plugin — composables that use it call
`gsap.registerPlugin(SplitText)` at their own module level.

---

## 2. Import rule — composables vs. components

This is the single rule most likely to trip you up.

**In `app/composables/`** — import GSAP directly from the package:
```ts
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)  // at module level, safe to call multiple times
```

**In `.vue` files and `app/assets/js/` helpers** — use the plugin-provided instances:
```ts
const { $gsap, $ScrollTrigger } = useNuxtApp()
```

Why the split: composables run during SSR where `useNuxtApp()` may not have the plugin yet. Direct
imports are ESM-cached singletons — you get the same instance every time, so `registerPlugin` at
module level is idempotent and safe.

Never mix the two within the same file — if a composable imports `gsap` directly, it should use
`gsap` throughout, not switch to `$gsap` mid-function.

---

## 3. State gating — introComplete and pageTransitioning

Two `useState` keys control when animations are allowed to fire:

| Key | Type | Default | Set to `true` when |
|-----|------|---------|---------------------|
| `introComplete` | `boolean` | `false` | Intro animation overlay finishes |
| `pageTransitioning` | `boolean` | `false` | Page transition overlay is active |

`introComplete` is initialized to `false` in `app/app.vue` and set to `true` once by the intro
animation component. It stays `true` for all subsequent SPA navigations — so second-visit pages
animate immediately without waiting.

`pageTransitioning` is flipped `true` at transition start and `false` when the overlay has
finished. Animations should not run while it is `true`.

### The gating pattern

Every composable that uses `initXxx()` follows this check:

```ts
const introComplete     = useState('introComplete', () => false)
const pageTransitioning = useState('pageTransitioning', () => false)

function initXxx(): void {
  if (introComplete.value && !pageTransitioning.value) {
    _doAnimate()
  } else {
    _pendingAnim = true  // flag so the watcher below picks it up
  }
}
```

Set up watchers at composable init time (not inside `onMounted`) so they're ready before the
state ever changes:

```ts
if (import.meta.client) {
  const stopIntroWatch = watch(introComplete, (val) => {
    if (val && _pendingAnim) { _pendingAnim = false; _doAnimate() }
  })
  const stopTransitionWatch = watch(pageTransitioning, (val) => {
    if (!val && _pendingAnim) { _pendingAnim = false; _doAnimate() }
  })
  // Store both stop functions so destroy() can clean them up
  _stopWatchers = () => { stopIntroWatch(); stopTransitionWatch() }
}
```

`useInview` does not use `_pendingAnim` — instead it just watches both states and calls
`addInviewClasses()` reactively, since IntersectionObservers handle the "already visible on load"
case with a layout-position fallback.

---

## 4. Composable lifecycle contract

Every composable returns an object with at minimum `{ initXxx, destroy }`. The caller is
responsible for wiring the lifecycle:

```ts
// In any .vue file using an animation composable:
const { initLetters, destroy } = useLetterAnimation()

onMounted(() => initLetters())
onUnmounted(() => destroy())
```

`initXxx()` is always called from `onMounted` — never inline at setup time, because the DOM
does not exist yet during setup.

`destroy()` must always be called in `onUnmounted`. Skipping it leaks ScrollTrigger instances,
IntersectionObservers, and document event listeners across page navigations.

Some composables expose an additional imperative function (e.g. `animLetters(el)`,
`animWords(el)`) for cases where you need to trigger the animation on a specific element
programmatically rather than querying the whole DOM.

---

## 5. Cleanup patterns by resource type

Each resource type has its own cleanup mechanism:

**ScrollTrigger instances**
```ts
const scrollTriggers: ScrollTrigger[] = []

// When creating:
const trigger = ScrollTrigger.create({ ... })
scrollTriggers.push(trigger)

// In destroy():
scrollTriggers.forEach((st) => st.kill())
scrollTriggers.length = 0
```

**Vue watchers**
```ts
let _stopWatchers: (() => void) | null = null

// In bootstrap:
const stopA = watch(someState, handler)
const stopB = watch(otherState, handler)
_stopWatchers = () => { stopA(); stopB() }

// In destroy():
_stopWatchers?.()
_stopWatchers = null
```

**IntersectionObservers**
```ts
const observers: IntersectionObserver[] = []

// When creating:
const observer = new IntersectionObserver(callback, options)
observer.observe(el)
observers.push(observer)

// In destroy():
observers.forEach((obs) => obs.disconnect())
observers.length = 0
```

**Document event listeners** (initPage pattern)
```ts
// In bootstrap:
document.fonts.ready.then(() => {
  document.addEventListener(triggerEvent, initFn)
})

// In destroy():
document.removeEventListener(triggerEvent, initFn)
```

**RAF loops** (`useMarquee` pattern)
```ts
let rafId: number | null = null

// Start:
rafId = requestAnimationFrame(tick)

// In cleanup (onBeforeUnmount):
if (rafId !== null) cancelAnimationFrame(rafId)
```

---

## 6. The two-phase split/animate pattern

`useLetterAnimation` uses a two-phase approach that is the correct model for any animation that
must split text before animating it:

**Phase 1 — split immediately** (runs in `initLetters()`, always):
```ts
function _doSplit(): void {
  // SplitText + gsap.set(letters, { opacity: 0, filter: 'blur(Xpx)' })
  // gsap.set(el, { opacity: 1 })  // reveal parent after hiding children
}
```

Splitting happens immediately on mount regardless of state, because:
- The DOM is available
- The user should never see the unsplit text flash (parent starts `opacity: 0` in CSS,
  then letters are hidden, then parent is revealed)

**Phase 2 — animate** (deferred until state allows):
```ts
function _doAnimate(): void {
  requestAnimationFrame(() => {
    // animate [data-letters] immediately
    // create ScrollTriggers for [data-scroll-letters]
  })
}
```

This separation means `initLetters()` is safe to call on mount even if the intro hasn't
finished — the split happens right away, the animation waits.

---

## 7. The initPage event pattern

`useLineReveal`, `useWordFade`, and `useWordReveal` use a custom DOM event instead of the
`introComplete` watcher approach:

```ts
// Bootstrap (in composable, not in onMounted):
if (import.meta.client) {
  document.fonts.ready.then(() => {
    document.addEventListener('initPage', initFn)
  })
}
```

The `document.fonts.ready` guard ensures SplitText measures word/line metrics after custom fonts
are loaded — splitting before fonts load produces incorrect break points.

To trigger these composables, dispatch the event from whatever controls page readiness:
```ts
document.dispatchEvent(new Event('initPage'))
```

This is functionally equivalent to calling `initFn()` directly — the event is a coordination
mechanism so multiple composables can listen on the same signal without one needing to know about
the others. The `triggerEvent` option (default `'initPage'`) lets you customize the event name.

Cleanup removes the listener:
```ts
function destroy(): void {
  document.removeEventListener(triggerEvent, initFn)
  // also kill any ScrollTriggers created inside initFn
}
```

Note: these composables do **not** use the `introComplete`/`pageTransitioning` watcher approach.
They rely entirely on the caller dispatching `initPage` at the right moment.

---

## 8. CSS vs GSAP — which to use

| Use case | Approach | Why |
|----------|----------|-----|
| Scroll presence toggle (add class when in view) | `useInview` — IntersectionObserver + CSS | CSS handles the actual transition; IO is lightweight and avoids GSAP overhead |
| Text sliding up on scroll (line reveal) | `useLineReveal` — SplitText + CSS class | CSS transitions per `.splitChild` span; no per-element tween needed |
| Letter-by-letter blur+fade reveal | `useLetterAnimation` — GSAP `fromTo` | Requires per-letter timing control (stagger, blur filter) that CSS can't do cleanly |
| Word-by-word reveal on scroll | `useWordReveal` — GSAP `to` | Per-word stagger delay; CSS can't express this without JS-applied inline delays |
| Word opacity scrub tied to scroll position | `useWordFade` — GSAP scrubbed timeline | `scrub: true` locks animation to scroll position; only GSAP + ScrollTrigger does this |
| Generic scroll entrance animation | `useInview` — CSS transition | Simpler, no GSAP dependency, CSS handles timing |

The rule: reach for CSS + class toggle whenever the animation is a single-property transition
that fires once when an element enters the viewport. Use GSAP when you need per-element stagger,
scrubbing, blur filters, or coordinated timelines.

---

## 9. Lenis integration

Lenis runs its own `requestAnimationFrame` loop independently of GSAP. There is **no**
`ScrollTrigger.scrollerProxy()` setup — they are not synced.

What this means in practice:
- ScrollTrigger reads `window.scrollY` directly (Lenis doesn't intercept it for ST)
- Lenis `lerp` easing does not affect ScrollTrigger trigger positions — triggers fire based on
  the actual scroll position, not the smoothed visual position
- This is intentional — the project chose simplicity over perfect sync

Access Lenis in a `.vue` component or helper:
```ts
const { $lenis } = useNuxtApp()

// Scroll to a position
$lenis.scrollTo(targetEl, { offset: -100 })

// Scroll to top immediately (no easing)
$lenis.scrollTo(0, { immediate: true })
```

Do not manually call `lenis.raf()` — the plugin handles the RAF loop. Do not create a second
Lenis instance.

---

## 10. Module-level helpers (not composables)

Two helpers in `app/assets/js/components/` are plain functions, not Vue composables — they have
no lifecycle management:

**`initMagneticButtons(selector = '.magnetic')`** — floating sine-wave animation on `.magnetic`
elements. Uses a shared `requestAnimationFrame` tick and a `Map` to track instances. Elements are
garbage-collected from the map automatically when disconnected from the DOM (`!el.isConnected`).
No explicit cleanup API. Call once after mount.

Data attributes for per-element configuration:
- `data-float-range-x`, `data-float-range-y` — amplitude in px (defaults to half element dimensions)
- `data-float-speed-x`, `data-float-speed-y` — speed factor (default `0.001`)

**`initVariableFontHover(selector, options)`** — variable-font `font-variation-settings` hover
effect. Splits the element's text into `.char` spans and animates `wght` based on mouse proximity.
Uses GSAP `to` with `overwrite: true` for smooth per-character updates. No cleanup API — listeners
are added per-element and stay for the component's lifetime.

Options: `minWght`, `maxWght`, `wdth`, `radiusMultiplier`, `ignoreMobile` (default `true`),
`mobileWidth` (default `580`).

Import these directly since they live in `app/assets/js/`:
```ts
import { initMagneticButtons } from '~/assets/js/components/magnetic'
import { initVariableFontHover } from '~/assets/js/components/mouse'
```

---

## 11. SSR and client-only guards

All DOM access, `window`, `document`, and watcher registration must be guarded:

```ts
// ✅ Correct — watcher inside import.meta.client
if (import.meta.client) {
  watch(introComplete, handler)
  document.fonts.ready.then(() => { ... })
}

// ✅ Correct — access inside onMounted (always client)
onMounted(() => {
  const el = document.querySelector('[data-letters]')
})

// ❌ Wrong — bare document access at composable setup level
const el = document.querySelector('[data-letters]')  // crashes during SSR
```

Composables that use `useMarquee` receive Vue `Ref` elements rather than direct DOM access at
setup time — the actual DOM reads happen inside `onMounted`, which `useMarquee` calls internally.

---

## 12. Anti-patterns to avoid

**Don't call `ScrollTrigger.killAll()`** — it kills every ScrollTrigger on the page, including
those owned by other components. Kill only the instances your composable created (stored array).

**Don't use `$gsap` or `$ScrollTrigger` in composables** — use direct imports (see §2).

**Don't create ScrollTriggers before the intro is complete** — they may fire immediately for
elements in the viewport, bypassing the intro sequence. Always gate via `introComplete`.

**Don't import from `@storyblok/nuxt` or other plugins inside animation composables** — keep
animation composables pure; they should have no awareness of CMS data.

**Don't skip `onUnmounted` cleanup** — every navigation re-mounts components; leaked
ScrollTriggers accumulate and eventually fire for elements that no longer exist.

**Don't use `gsap.context()`** — not used in this codebase. Cleanup is handled by the stored
array + `st.kill()` pattern. Don't introduce `context.revert()` patterns.

---

## Related skills

- **File locations for composables and JS helpers** → `code-structure-conventions`
- **CSS animation tokens (@ease, @durationFast, etc.)** → `less-design-system`
- **Styling animated components** → `less-design-system`

Full composable API reference with all options and data attributes → `references/composable-catalog.md`
