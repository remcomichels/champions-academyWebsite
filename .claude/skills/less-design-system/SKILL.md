---
name: less-design-system
description: >
  Enforces the LESS styling system for this Nuxt 4 boilerplate. Use this skill any time you are
  writing or modifying styles — including when the user says "style this", "add some CSS",
  "make this responsive", "change the color", "add padding", "add margin", "set the font size",
  "make this look like X", "create a card component", "add a hover state", or any other phrasing
  that involves visual appearance or layout. Also fire when creating a new LESS file, adding a
  <style> block, working with breakpoints, or sizing anything (width, height, font-size, gap,
  padding, margin). Critical: this skill contains the auto-injection rule — never @import
  _variables.less, _mixins.less, or _constants.less. These are globally available in every LESS
  context and importing them causes duplicate variable errors.
---

# LESS Design System

This skill covers the rules that diverge from standard Vue/Nuxt styling defaults. Generic Nuxt
knowledge will produce wrong output here — read this before writing any styles.

---

## 1. The auto-injection rule

Three files are injected into every LESS context automatically via Vite `additionalData`.
They are available everywhere without any import statement:

- `_variables.less` — colors, fonts, font weights, spacing tokens
- `_mixins.less` — positioning, transition, animation, layout helpers
- `_constants.less` — pre-calculated `@vwN` unit constants for all three breakpoints

**Never write `@import '~/.../variables'` or similar.** The variables are already there.
Adding an import causes duplicate declaration errors.

Global entry-point styles (`_reset.less`, `_general.less`, component files) are loaded via
`main.less`, which is registered in `nuxt.config.ts`. Don't add these to `additionalData`
either — they're in the global CSS pipeline.

---

## 2. The vw unit system

All sizing — font-size, padding, margin, gap, width, height, border-radius — uses pre-calculated
viewport-width constants instead of raw `px`, `rem`, or `vw` values. The constants are named
for the pixel size they represent at the baseline viewport (1440px):

```less
// These constants represent a real pixel size at their respective breakpoint viewport width
@vw40        // ≈ 40px at 1440px viewport  → use at baseline (no media query)
@vw40-1080   // ≈ 40px at 1080px viewport  → use inside @media (max-width: 1080px)
@vw40-580    // ≈ 40px at 580px viewport   → use inside @media (max-width: 580px)
```

This keeps sizes visually proportional across viewports without magic numbers. Using raw `40px`
or `2.777778vw` is wrong — find or use the constant.

The full constant table is in `references/tokens.md`. Available range: `@vw1` through `@vw300`
at all three breakpoints.

### Responsive pattern

Write the baseline styles first, then override inside media queries using the matching suffix:

```less
.myElement {
  padding: @vw40;                          // baseline (≥1440px)

  @media (max-width: 1080px) {
    padding: @vw40-1080;                   // tablet
  }

  @media (max-width: 580px) {
    padding: @vw24-580;                    // mobile (can use a different value)
  }
}
```

The three canonical breakpoints are `1080px` and `580px`. Use these exact values — the vw
constants are calculated against them. A third breakpoint at `768px` is occasionally used for
layout-only changes (e.g. flex-direction) where no vw constant is needed.

### When no constant matches exactly

Round to the nearest available constant. `37px` → `@vw36` or `@vw40`; pick whichever is closer
to the design intent. There is no need for `clamp()` or raw `px` — a one-step visual rounding
is fine and keeps the codebase consistent. Raw pixel values are never an acceptable fallback.

---

## 3. Component style architecture

Each `.vue` component has its own LESS file at:
```
app/assets/less/components/<component-name>.less
```

Register it once in `app/assets/less/main.less`:
```less
@import './components/my-component.less';
```

That is the only registration needed. Do **not** add a `<style>` block to the `.vue` file to
import the same file — the `.vue` file should have no `<style>` block at all (unless it contains
a small amount of truly component-local inline styles that have no business being in a shared
LESS file).

**Why not `<style scoped>` + `@import`?** It compiles correctly (Vite detects the `.less`
extension without `lang="less"`), but it causes every rule to appear twice in the production CSS
bundle — once from `main.less` as a global unscoped rule, and once from the scoped block as a
`[data-v-xxxx]`-suffixed rule. The duplication bloats the bundle and can create specificity
surprises.

Write all styles inside the LESS file. The `.vue` file stays style-free.

---

## 4. Design tokens

Use variables for all colors and font families. Never hardcode hex, rgb, hsl values, or font
name strings.

### Colors
```less
// Core palette
@primary    // #50C887 — brand green
@secondary  // #0F52BA — brand blue
@accent     // #D4AF37 — brand gold

// Neutrals
@white      // #F1F2EE
@black      // #1C1C1C

// Semantic (use these for text/bg — they alias the above)
@text        // = @white
@title       // = @white
@background  // = @black
@border      // rgba(@white, 0.15)

// States
@error    @success    @warning
```

### Typography
```less
@heading      // 'Satoshi Variable', sans-serif
@body         // 'Mukta Vaani', sans-serif
@handWritten  // 'GloriaHallelujah', cursive

// Font weights
@light @regular @medium @semiBold @bold @extra-bold
```

### Spacing tokens
```less
@row-gap     // clamp(1em, 1.75vw, 2em)
@column-gap  // clamp(1em, 1.75vw, 2em)
```

### Animation tokens

```less
// Easings — @ease is the default and covers most cases
@ease         // cubic-bezier(.6, 0, .2, 1)   — signature curve, in-out feel
@easeOut      // cubic-bezier(0, 0, .2, 1)    — for elements entering the screen
@easeIn       // cubic-bezier(.6, 0, 1, 1)    — for elements leaving the screen
@easeBounce   // cubic-bezier(.34, 1.56, .64, 1) — springy/playful overshoot

// Durations
@durationFast    // 0.3s — hover states, micro-interactions, button feedback
@durationMedium  // 0.6s — panel opens, state changes, modal transitions
@durationSlow    // 0.9s — page-level entrances, hero reveals, large movements

// Stagger
@stagger      // 0.05s — multiply by nth-child index to cascade a list
```

These are CSS-only tokens; GSAP animations use their own timing and easing system.

Full token inventory: `references/tokens.md`.

---

## 5. Mixin reference

The most commonly used mixins (all auto-injected, no import needed):

```less
// Position an element absolutely, filling its parent by default
.absolute(@top: 0, @left: 0, @width: 100%, @height: 100%)

// Fix to viewport
.fixed(@height: 100%, @width: 100%, @top: 0, @left: 0)

// Transition shorthand — defaults: all | @durationFast (0.3s) | @ease
.transition(@prop: all, @duration: @durationFast, @ease: @ease)

// Multi-property transition — defaults: all | @durationFast | 0s delay | @ease
.transitionMore(@what: all, @duration: @durationFast, @delay: 0s, @ease: @ease)

// Staggered transition delays for nth-child lists
.transitionLoopSplitter(@i, @transition, @base: 0s)

// Aspect-ratio padding trick
.paddingRatio(@width, @height)

// Break out of a padded container
.fullWidth(@default: 36px, @medium: 32px, @small: 40px)
```

Calling either mixin with no arguments — `.transition();` — is the typical hover/interaction
pattern: it picks up `@durationFast` + `@ease` automatically. Only pass overrides when you need
a different duration, easing, or property. For complex transitions prefer `.transitionMore` over
writing `transition:` by hand.

---

## 6. What `_general.less` already establishes

Do not re-declare these in component styles — they're global:

- CSS reset (via `_reset.less`)
- `body`: font-family `@body`, font-size `clamp(16px, 1.2vw, 21px)`, color `@text`, background `@background`
- `h1–h6`: font-family `@heading`, color `@title`, line-height 1.2
- `h1` font-size: `clamp(2rem, @vw64, 4rem)`
- `p`: white-space `pre-line`, line-height 1.4
- `#pageContainer`: flex column, min-height 100vh
- `.section`: vertical padding using `@vw75` / `@vw75-1080` / `@vw50-580`
- `.container`, `.container-narrow`, `.container-wide`: horizontal padding variants
- `.parent-line` / `.link-line`: underline hover animation pattern
- `::selection`: brand primary color
- Lenis scroll compatibility rules

---

## 7. Naming conventions

- Class names: kebab-case (`.nav-item`, `.hero-title`, `.card-wrapper`)
- LESS variables: camelCase with `@` prefix (`@myColor`, `@headingSize`)
- Mixins: camelCase (`.transitionMore`, `.absoluteCenter`)
- LESS files: kebab-case matching the component name (`my-component.less`)

Nesting — keep selectors flat:

- Each element gets its own descriptive class (`.card-header`, `.card-title`,
  `.hero-image`), not nested descendant selectors (`.card .header .title`).
- Nest only for: pseudo-classes/elements (`&:hover`, `&::before`),
  modifier states (`&.is-active`, `&[data-open]`), or direct children that
  have no class of their own.
- Cap nesting at 3 levels. If you're deeper, add a class and flatten.

```less
// ✅ Correct — flat selectors, & for states
.card-header {
  padding: @vw24;

  &:hover { background: @primary; }
  &.is-featured { border-color: @accent; }
}

.card-title {
  font-family: @heading;
  color: @title;
}

// ❌ Wrong — HTML-mirroring descendant chains
.card {
  .header {
    .title {
      color: @primary;
    }
  }
}
```

This favors low-specificity, single-class selectors over descendant chains —
keeps specificity flat and makes HTML refactors safer.

---

## 8. `fonts.css`

This file is a shell for `@font-face` declarations. It is currently commented out — fonts are
served via `@nuxt/fonts` at runtime. When adding a self-hosted font, uncomment the template and
point the `src` to the font file in `public/fonts/`. The `@heading` and `@body` variables in
`_variables.less` will pick up the correct family name once declared.

---

## 9. Files to avoid as style examples

`error.less` currently uses hardcoded hex values (`#333`, `#007bff`) and `rem`/`px` units —
it's a placeholder that predates the design system. Don't model new component styles on it.

---

## Related skills

- **File locations and component creation** → `code-structure-conventions`
- **Storyblok component styling and v-editable** → `storyblok-patterns`
- **GSAP/ScrollTrigger animation timing** → `animation-patterns`
