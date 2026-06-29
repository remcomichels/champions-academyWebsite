# Composable Catalog

Full API reference for every animation composable and helper in this boilerplate.

---

## Table of contents
1. [useInview](#useinview)
2. [useLetterAnimation](#useletteranimation)
3. [useLineReveal](#uselinereveal)
4. [useWordFade](#usewordfade)
5. [useWordReveal](#usewordreveal)
6. [useMarquee](#usemarquee)
7. [initMagneticButtons](#initmagneticbuttons)
8. [initVariableFontHover](#initvariablefonthover)
9. [Data attribute quick reference](#data-attribute-quick-reference)

---

## useInview

**File:** `app/composables/useInview.ts`  
**Mechanism:** IntersectionObserver + CSS class toggle (not GSAP)  
**State gating:** watches `introComplete` and `pageTransitioning`

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scrollStart` | `string` | `'0% 90%'` | ScrollTrigger-style string used to compute IntersectionObserver rootMargin |
| `inviewClass` | `string` | `'inView'` | Class added to the element when it enters the viewport |

### Returns

```ts
{ initInview, addInviewClasses, destroy }
```

- `initInview()` — call from `onMounted`. Checks state and calls `addInviewClasses()` if ready; watchers handle the deferred case.
- `addInviewClasses()` — scans `[data-scroll-inview]` elements, adds `inviewClass` when they enter the viewport. Has a layout-position fallback for elements shifted out of IO range by CSS transforms.
- `destroy()` — disconnects all IntersectionObservers.

### Usage

```ts
const { initInview, destroy } = useInview()
onMounted(() => initInview())
onUnmounted(() => destroy())
```

### Data attributes

| Attribute | Effect |
|-----------|--------|
| `data-scroll-inview` | Marks element for observation. `inviewClass` is added when it enters the viewport. |
| `data-scroll-direct="true"` | Fires when element top hits the very bottom of the viewport (not 90%). |

---

## useLetterAnimation

**File:** `app/composables/useLetterAnimation.ts`  
**Mechanism:** SplitText + GSAP `fromTo` (blur+opacity per letter)  
**State gating:** `_pendingAnim` flag + watchers on `introComplete` and `pageTransitioning`  
**Two-phase:** splits immediately in `initLetters()`, animates only when state allows

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scrollStart` | `string` | `'0% 80%'` | ScrollTrigger start for `[data-scroll-letters]` elements |
| `mobileBreakpoint` | `number` | `580` | Viewport width below which `data-scroll-mobile-ignore` elements are skipped |
| `duration` | `number` | `0.9` | GSAP tween duration per letter (seconds) |
| `staggerDelay` | `number` | `0.03` | Per-letter delay multiplier (seconds × letter index) |
| `blurAmount` | `number` | `6` | Starting blur in px; animates to `blur(0px)` |

### Returns

```ts
{ initLetters, animLetters, destroy }
```

- `initLetters()` — splits all `[data-letters]` and `[data-scroll-letters]` immediately (hiding letters), then animates if state is ready or sets `_pendingAnim`.
- `animLetters(el)` — animates a specific element's `.letter` spans directly; useful for programmatic triggers.
- `destroy()` — kills all ScrollTrigger instances and stops the intro/transition watchers.

### Usage

```ts
const { initLetters, destroy } = useLetterAnimation({ duration: 0.8, staggerDelay: 0.025 })
onMounted(() => initLetters())
onUnmounted(() => destroy())
```

### Data attributes

| Attribute | Effect |
|-----------|--------|
| `data-letters` | Split and animate immediately when `introComplete` is true |
| `data-scroll-letters` | Split immediately, animate on scroll via ScrollTrigger |
| `data-scroll-direct="true"` | ScrollTrigger fires at bottom of viewport instead of `scrollStart` |
| `data-scroll-mobile-ignore="true"` | Skip the element entirely when viewport < `mobileBreakpoint` |

### CSS requirement

Elements using `data-letters` or `data-scroll-letters` should start with `opacity: 0` in CSS
to prevent a flash of unsplit text before `splitAndHide` runs. The composable calls
`gsap.set(el, { opacity: 1 })` after hiding the individual letters.

---

## useLineReveal

**File:** `app/composables/useLineReveal.ts`  
**Mechanism:** SplitText + CSS class toggle (no GSAP tween)  
**Trigger:** custom DOM event (`initPage` by default)  
**Fonts guard:** waits for `document.fonts.ready` before attaching listener

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `triggerEvent` | `string` | `'initPage'` | DOM event name that triggers `initLines()` |
| `linesClass` | `string` | `'splitChild'` | Class applied to each split line `<span>` |
| `inviewClass` | `string` | `'active'` | Class added to the root element to trigger CSS transitions |

### Returns

```ts
{ initLines, destroy }
```

- `initLines()` — queries `[data-lines]`, splits into line spans, then adds `inviewClass` in the next `requestAnimationFrame`.
- `destroy()` — removes the document event listener.

### Usage

```ts
const { initLines, destroy } = useLineReveal()
// initLines is called automatically when 'initPage' is dispatched
// call destroy in onUnmounted to remove the listener
onUnmounted(() => destroy())
```

Or call directly:
```ts
onMounted(() => initLines())
onUnmounted(() => destroy())
```

### Data attributes

| Attribute | Effect |
|-----------|--------|
| `data-lines` | Element's text is split into `.splitChild` line spans, then `active` class is added |

### CSS pattern

```less
.my-element {
  .splitChild {
    display: block;
    opacity: 0;
    transform: translateY(101%);
    .transition(transform, @durationMedium, @ease);
    .transitionMore(opacity, @durationMedium, 0s, @ease);
  }

  &.active .splitChild {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## useWordFade

**File:** `app/composables/useWordFade.ts`  
**Mechanism:** SplitText + GSAP scrubbed timeline (opacity tied to scroll position)  
**Trigger:** custom DOM event (`initPage` by default)  
**Fonts guard:** waits for `document.fonts.ready`

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `triggerEvent` | `string` | `'initPage'` | DOM event name that triggers `initWordFade()` |
| `opacityFrom` | `number` | `0.2` | Starting opacity of each word before it scrolls into focus |
| `scrollStart` | `string` | `'top 70%'` | ScrollTrigger start position |
| `scrollEnd` | `string` | `'bottom 70%'` | ScrollTrigger end position |
| `scrub` | `boolean \| number` | `true` | `true` = locked to scroll; `number` = seconds of smoothing lag |

### Returns

```ts
{ initWordFade, destroy }
```

- `initWordFade()` — queries `[data-word-fade]`, splits into word spans with `wf-word` class, sets initial opacity, creates a scrubbed GSAP timeline per element. Guard: `data-word-fade-initialized` prevents double-init.
- `destroy()` — kills all ScrollTrigger instances and removes the event listener.

### Data attributes

| Attribute | Effect |
|-----------|--------|
| `data-word-fade` | Words fade from `opacityFrom` to 1 in sequence as the user scrolls |

### How scrub timing works

The total scroll distance between `scrollStart` and `scrollEnd` is divided equally among all
words. A 5-word sentence and a 30-word paragraph both reveal across the same scroll distance —
the per-word slice just gets smaller with more words. Use a taller `scrollEnd` (e.g.
`'bottom -50%'`) for long paragraphs that should reveal more slowly.

---

## useWordReveal

**File:** `app/composables/useWordReveal.ts`  
**Mechanism:** SplitText + GSAP `to` (y, rotate, opacity per word)  
**Trigger:** custom DOM event (`initPage` by default)  
**Fonts guard:** waits for `document.fonts.ready`

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `triggerEvent` | `string` | `'initPage'` | DOM event name |
| `scrollStart` | `string` | `'0% 90%'` | ScrollTrigger start for `[data-scroll-words]` elements |
| `duration` | `number` | `0.9` | GSAP tween duration per word (seconds) |
| `delayNormal` | `number` | `0.3` | Per-word stagger when `data-words-fast` is absent |
| `delayFast` | `number` | `0.1` | Per-word stagger when `data-words-fast="true"` |

### Returns

```ts
{ initWords, animWords, destroy }
```

- `initWords()` — two passes: (1) splits `[data-words]` into `.word` spans and adds `active` class immediately; (2) creates ScrollTriggers for `[data-scroll-words]`.
- `animWords(el)` — animates `.word` children of a specific element; called by the ScrollTrigger `onEnter`. Can also be called directly for programmatic triggers.
- `destroy()` — kills all ScrollTriggers and removes the event listener.

### Data attributes

| Attribute | Effect |
|-----------|--------|
| `data-words` | Split into `.word` spans, animated immediately via `active` class + CSS |
| `data-scroll-words` | Split and animate on scroll when element enters viewport |
| `data-scroll-direct="true"` | Animate when element top hits the very bottom of the viewport |
| `data-words-fast="true"` | Use `delayFast` stagger instead of `delayNormal` |

### CSS requirement

```css
.active .word {
  display: inline-block;
  opacity: 0;
  transform: translateY(20px) rotate(5deg);
}
.transformNone {
  transform: none !important;  /* applied by animWords onComplete */
}
```

---

## useMarquee

**File:** `app/composables/useMarquee.ts`  
**Mechanism:** pure `requestAnimationFrame` loop with scroll-velocity sampling  
**Lifecycle:** uses `onMounted` / `onBeforeUnmount` internally — do NOT call from onMounted yourself

### Signature

```ts
useMarquee(
  marqueeEl: Ref<HTMLElement | null>,
  scrollEl: Ref<HTMLElement | null>,
  trackA: Ref<HTMLElement | null>,
  trackB: Ref<HTMLElement | null>
): void
```

Receives four template refs and wires everything internally. Returns nothing.

### Usage

```ts
const marqueeEl = ref<HTMLElement | null>(null)
const scrollEl  = ref<HTMLElement | null>(null)
const trackA    = ref<HTMLElement | null>(null)
const trackB    = ref<HTMLElement | null>(null)

useMarquee(marqueeEl, scrollEl, trackA, trackB)
// No onMounted/onUnmounted needed — handled internally
```

### Required HTML structure

```html
<div ref="marqueeEl" data-marquee-direction="left">
  <div ref="scrollEl">
    <div ref="trackA"><!-- repeated content --></div>
    <div ref="trackB"><!-- identical duplicate for seamless loop --></div>
  </div>
</div>
```

`trackB` is positioned absolutely at `left: trackWidth` to create a seamless loop. Both tracks
move at the same speed; when `x <= -trackWidth`, `x` snaps back by `trackWidth`.

### Data attributes (read from the DOM at runtime)

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-marquee-speed` | `20` | Base pixels per second |
| `data-marquee-direction` | `'left'` | `'left'` or `'right'` |
| `data-marquee-status` | `'normal'` | `'normal'` or `'inverted'`; auto-set by scroll direction |
| `data-marquee-touch-threshold` | `0.25` (touch) / `1` (mouse) | Minimum scroll delta to flip direction |
| `data-marquee-velocity-timeout` | `80` | ms after last scroll event before velocity decays to 0 |
| `data-marquee-sample-window` | `120` | ms window for velocity sampling |
| `data-scroll-speed` on `scrollEl` | `1` | Multiplier applied to base speed |

---

## initMagneticButtons

**File:** `app/assets/js/components/magnetic.ts`  
**Mechanism:** sine-wave `requestAnimationFrame` loop, no GSAP  
**Cleanup:** automatic — elements removed from DOM drop out of the shared tick

### Signature

```ts
import { initMagneticButtons } from '~/assets/js/components/magnetic'

initMagneticButtons(selector?: string)  // default '.magnetic'
```

Call after mount. The RAF loop starts on first call and self-stops when no `.magnetic` elements
remain connected. Calling again with new elements re-uses the existing loop.

### Data attributes (per element)

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-float-range-x` | Half element width | Horizontal amplitude in px |
| `data-float-range-y` | Half element height | Vertical amplitude in px |
| `data-float-speed-x` | `0.001` | Horizontal sine frequency |
| `data-float-speed-y` | `0.001` | Vertical sine frequency |

Each element gets a ±15% random speed variation so multiple elements don't oscillate in sync.

---

## initVariableFontHover

**File:** `app/assets/js/components/mouse.ts`  
**Mechanism:** splits text into `.char` spans, animates `font-variation-settings` via GSAP on mousemove

### Signature

```ts
import { initVariableFontHover } from '~/assets/js/components/mouse'

initVariableFontHover(selector: string, options?: VariableFontHoverOptions)
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `minWght` | `200` | Font weight at maximum proximity |
| `maxWght` | `900` | Font weight at rest (no mouse nearby) |
| `wdth` | `100` | Fixed `wdth` axis value |
| `radiusMultiplier` | `3` | Influence radius = element height × this value |
| `ignoreMobile` | `true` | Skip when `window.innerWidth <= mobileWidth` |
| `mobileWidth` | `580` | Mobile cutoff width in px |

Characters closest to the cursor receive the lowest `wght` (thinnest), characters farther away
return to `maxWght`. GSAP `overwrite: true` prevents animation queue buildup on fast mouse moves.

No cleanup API — `mousemove` / `mouseleave` listeners persist for the element's lifetime.

---

## Data attribute quick reference

| Attribute | Composable | Effect |
|-----------|-----------|--------|
| `data-scroll-inview` | `useInview` | Toggle `inView` class on scroll enter |
| `data-letters` | `useLetterAnimation` | Letter blur+fade, fires on `introComplete` |
| `data-scroll-letters` | `useLetterAnimation` | Letter blur+fade, fires on scroll |
| `data-lines` | `useLineReveal` | Line slide-up via CSS class |
| `data-word-fade` | `useWordFade` | Word opacity scrubbed to scroll |
| `data-words` | `useWordReveal` | Word reveal, immediate |
| `data-scroll-words` | `useWordReveal` | Word reveal, on scroll |
| `data-scroll-direct="true"` | multiple | Trigger at bottom of viewport (not 90%) |
| `data-scroll-mobile-ignore="true"` | `useLetterAnimation` | Skip element on mobile |
| `data-words-fast="true"` | `useWordReveal` | Faster per-word stagger |
