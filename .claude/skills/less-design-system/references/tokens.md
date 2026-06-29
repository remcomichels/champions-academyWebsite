# Token Reference

Load this file when you need the full token inventory or vw constant table.

---

## Table of contents
1. [Color tokens](#color-tokens)
2. [Typography tokens](#typography-tokens)
3. [Spacing tokens](#spacing-tokens)
4. [Animation tokens](#animation-tokens)
5. [vw constant system](#vw-constant-system)

---

## Color tokens

```less
// Core palette
@primary:    #50C887;   // brand green
@secondary:  #0F52BA;   // brand blue
@accent:     #D4AF37;   // brand gold

// Neutrals
@white:  #F1F2EE;
@black:  #1C1C1C;

// Semantic aliases
@text:        @white;
@title:       @white;
@background:  @black;
@border:      rgba(@white, 0.15);

// State colors
@error:    #e74c3c;
@success:  #2ecc71;
@warning:  #f39c12;
```

---

## Typography tokens

```less
// Font families
@heading:      'Satoshi Variable', sans-serif;
@body:         'Mukta Vaani', sans-serif;
@handWritten:  'GloriaHallelujah', cursive;

// Font weights
@light:       300;
@regular:     400;
@medium:      500;
@semiBold:    600;
@bold:        700;
@extra-bold:  900;
```

---

## Spacing tokens

```less
@row-gap:     clamp(1em, 1.75vw, 2em);
@column-gap:  clamp(1em, 1.75vw, 2em);
```

---

## Animation tokens

```less
// Easings
@ease:        cubic-bezier(.6, 0, .2, 1);    // default — signature in-out curve
@easeOut:     cubic-bezier(0, 0, .2, 1);     // for elements entering the screen
@easeIn:      cubic-bezier(.6, 0, 1, 1);     // for elements leaving the screen
@easeBounce:  cubic-bezier(.34, 1.56, .64, 1); // springy overshoot
```

| Token | Value | When to use |
|-------|-------|-------------|
| `@ease` | `cubic-bezier(.6, 0, .2, 1)` | Default — hover states, most transitions |
| `@easeOut` | `cubic-bezier(0, 0, .2, 1)` | Element entering (slides in, fades in) |
| `@easeIn` | `cubic-bezier(.6, 0, 1, 1)` | Element leaving (slides out, fades out) |
| `@easeBounce` | `cubic-bezier(.34, 1.56, .64, 1)` | Playful/springy overshoot (tooltips, badges) |

```less
// Durations
@durationFast:    0.3s;   // hover states, micro-interactions, button feedback
@durationMedium:  0.6s;   // panel opens, state changes, modal transitions
@durationSlow:    0.9s;   // page-level entrances, hero reveals, large movements
```

```less
// Stagger
@stagger:  0.05s;   // per-index delay unit — multiply by nth-child index
```

Stagger example — cascade a list of items:
```less
.navItem {
  .transitionLoopSplitter(5, @stagger);  // items 1–5 get 0.05s, 0.10s, 0.15s... delays
}
```

These are CSS-only tokens. GSAP animations use their own timing/easing system — do not apply
these tokens inside GSAP `.to()` / `.from()` calls.

---

## vw constant system

Constants are pre-calculated viewport-width values. Each number represents the intended pixel
size at the baseline viewport for that suffix.

| Suffix | Baseline viewport | Media query to use inside |
|--------|------------------|--------------------------|
| (none) `@vwN` | 1440px | no query — baseline styles |
| `-1080` `@vwN-1080` | 1080px | `@media (max-width: 1080px)` |
| `-580` `@vwN-580` | 580px | `@media (max-width: 580px)` |

Available range: `@vw1` through `@vw300` at all three breakpoints.

### How the math works

`@vw40` = `40 / 1440 * 100vw` = `2.778vw`  
`@vw40-1080` = `40 / 1080 * 100vw` = `3.704vw`  
`@vw40-580` = `40 / 580 * 100vw` = `6.897vw`

Using the matching constant at the matching breakpoint keeps the element at visually ~40px
regardless of viewport. You can intentionally pick a different value at a breakpoint (e.g.
`@vw24-580` at mobile) to reduce the size for smaller screens.

### Common values quick reference

| Intended size | Baseline | 1080 | 580 |
|--------------|----------|------|-----|
| 8px  | `@vw8`  | `@vw8-1080`  | `@vw8-580`  |
| 12px | `@vw12` | `@vw12-1080` | `@vw12-580` |
| 16px | `@vw16` | `@vw16-1080` | `@vw16-580` |
| 20px | `@vw20` | `@vw20-1080` | `@vw20-580` |
| 24px | `@vw24` | `@vw24-1080` | `@vw24-580` |
| 32px | `@vw32` | `@vw32-1080` | `@vw32-580` |
| 40px | `@vw40` | `@vw40-1080` | `@vw40-580` |
| 48px | `@vw48` | `@vw48-1080` | `@vw48-580` |
| 56px | `@vw56` | `@vw56-1080` | `@vw56-580` |
| 64px | `@vw64` | `@vw64-1080` | `@vw64-580` |
| 80px | `@vw80` | `@vw80-1080` | `@vw80-580` |
| 100px | `@vw100` | `@vw100-1080` | `@vw100-580` |
| 120px | `@vw120` | `@vw120-1080` | `@vw120-580` |
| 160px | `@vw160` | `@vw160-1080` | `@vw160-580` |
| 200px | `@vw200` | `@vw200-1080` | `@vw200-580` |
