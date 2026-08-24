# Dashboard Design System — Neutral / Dual-Theme

Scope: dashboard only. Marketing site keeps its existing green-primary system untouched.
Scale (`@vwN`), spacing rhythm, radius ladder, type, and interaction rules from the base
system are **inherited as-is** — only the color layer changes here.

---

## 1. Why two token sets, not one

Your current color system is one base (`@black`) with a white fade ladder on top. A
light/dark dashboard needs *two* bases, so `fade(@white, N%)` can't be the whole story —
in light mode you're fading toward black, not white. Cleanest fix: move color to CSS
custom properties that flip per `[data-theme]`, and keep everything else (scale, spacing,
radius, `.transition()`, focus patterns) exactly as-is since those aren't color-dependent.

```html
<html data-theme="dark">   <!-- or "light" -->
```

```less
// still valid, still used everywhere:
padding: @vw32;
border-radius: @vw10;
border: max(1px, @vw1) solid var(--border);   // <- only this part changes
```

---

## 2. Neutral scale

Pulled from the two references: image 1's light mode is a **cool** off-white (not warm
paper-white), image 3's dark mode is **near-black with almost no lift** on cards — the
surface barely separates from the background, hierarchy comes from borders and text
weight, not from big luminance jumps. Kept that restraint.

### Dark theme (default)

| Token | Value | Used for |
|---|---|---|
| `--background` | `#0A0A0C` | page background |
| `--surface` | `#131316` | card |
| `--surface-raised` | `#1C1C20` | inner surface (stat tiles, inputs, nested cards) |
| `--surface-hover` | `#1A1A1E` | row/card hover |
| `--border` | `rgba(255,255,255,0.08)` | default border |
| `--border-strong` | `rgba(255,255,255,0.14)` | active/focused border, dividers that need to read |
| `--text` | `#F2F2F4` | primary text — soft white, never pure `#FFF` |
| `--text-secondary` | `rgba(255,255,255,0.58)` | labels, secondary values |
| `--text-tertiary` | `rgba(255,255,255,0.38)` | timestamps, hints, placeholders |
| `--text-disabled` | `rgba(255,255,255,0.22)` | disabled state |

### Light theme

| Token | Value | Used for |
|---|---|---|
| `--background` | `#F7F7F8` | page background (cool gray, not `#FFF`) |
| `--surface` | `#FFFFFF` | card |
| `--surface-raised` | `#F1F1F3` | inner surface (stat tiles, inputs, nested cards) |
| `--surface-hover` | `#EFEFF1` | row/card hover |
| `--border` | `rgba(10,10,12,0.08)` | default border |
| `--border-strong` | `rgba(10,10,12,0.16)` | active/focused border, dividers that need to read |
| `--text` | `#0A0A0C` | primary text |
| `--text-secondary` | `rgba(10,10,12,0.58)` | labels, secondary values |
| `--text-tertiary` | `rgba(10,10,12,0.40)` | timestamps, hints, placeholders |
| `--text-disabled` | `rgba(10,10,12,0.24)` | disabled state |

Both ladders use the **same opacity steps** (58 / 38–40 / 22–24) so text hierarchy feels
identical whichever theme you're in — only the base flips. That consistency is worth
protecting; don't let designers pick new opacity values per-theme later.

---

## 3. Accent — used sparingly, on purpose

One accent, used for exactly the things that should pull the eye first: a primary CTA,
the active nav/tab state, a focused input ring, one highlighted bar/line in a chart, a
positive-emphasis number if you want a beat stronger than plain white/black text. Not on
every icon, every border, every hover. That restraint is the whole point of the "generic
black/white with a cool accent" brief — if it ends up on more than ~1 element per screen,
it's being overused.

| Token | Value | Notes |
|---|---|---|
| `--accent` | `#7C5CFC` | base — a cool violet, not the warm/pink end of purple |
| `--accent-hover` | `#8F73FF` | hover on accent-filled elements |
| `--accent-pressed` | `#6647E0` | active/pressed |
| `--accent-subtle` | `rgba(124,92,252,0.12)` | chip/badge fill behind accent text — same recipe as your existing `fade(@primary,12%)` chip pattern |
| `--accent-ring` | `rgba(124,92,252,0.28)` | focus ring / box-shadow glow |
| `--on-accent` | `#FFFFFF` | text/icon on a solid accent fill — same in both themes |

Same hex in light and dark — violet at this saturation holds up on both a near-black and
a near-white surface without needing a per-theme variant, so it's one less thing to keep in sync.

Semantic status colors (`error` / `success` / `warning`) carry over unchanged from the
base system — they're already theme-agnostic-friendly at their current saturation.

---

## 4. Card — one language, not two

Base doc flags that marketing currently runs two card styles (bordered vs. borderless).
For the dashboard, standardize on **one**: bordered, on both themes — that's what both
references do, and a border is what keeps a `--surface` card legible against
`--background` when the luminance gap between them is intentionally small (dark theme
especially: `#131316` on `#0A0A0C` is a ~3% lift, the border is doing real work, not decoration).

```less
.dashPanel {
  background: var(--surface);
  border: max(1px, @vw1) solid var(--border);
  border-radius: @vw10;
  padding: @vw32;
}
```

Nesting rule from the base system still applies and still inverts:

```
page       --background
└─ card    --surface        (+ border, radius @vw10)
   └─ inner --surface-raised (+ border, radius @vw8)   // stat tiles, readonly fields, chart containers
```

Don't let `--surface-raised` drift toward `--surface` — the two need to stay visually
distinct or nested tiles disappear into the card, which is the exact flattening problem
the base doc already warned about.

---

## 5. Data viz

Both references keep charts almost entirely neutral — gray bars, no rainbow of series
colors — and save color for the one number that matters. Carry that over:

| Token | Value (dark) | Value (light) | Used for |
|---|---|---|---|
| `--chart-bar` | `rgba(255,255,255,0.16)` | `rgba(10,10,12,0.16)` | default bar/area fill |
| `--chart-bar-hover` | `rgba(255,255,255,0.28)` | `rgba(10,10,12,0.28)` | hovered/tooltip'd bar |
| `--chart-bar-highlight` | `var(--accent)` | `var(--accent)` | the one bar/line you want to call out (current period, selected point) |
| `--chart-grid` | `rgba(255,255,255,0.06)` | `rgba(10,10,12,0.06)` | gridlines |
| `--chart-axis-text` | `var(--text-tertiary)` | `var(--text-tertiary)` | axis labels |

Rule of thumb: if every bar in a chart is `--accent`, it's not an accent anymore — reserve
`--chart-bar-highlight` for a single series or the current-period bar, everything else stays neutral.

---

## 6. Components

**Buttons**
- Primary (rare — one per screen, the actual next action): `--accent` fill, `--on-accent` text, hover `--accent-hover`
- Default/secondary (most buttons): `--surface-raised` fill, `--text` text, `--border` outline
- Ghost: transparent, `--text-secondary`, hover → `--surface-hover`

**Inputs**
- Fill: `--surface-raised`, border `--border`, text `--text`, placeholder `--text-tertiary`
- Focus: border → `--accent`, `box-shadow: 0 0 0 max(2px, @vw2) var(--accent-ring)` — same pattern as base doc's input focus recipe, just swap `fade(@primary,25%)` for `--accent-ring`

**Badges / chips / status pills**
- Neutral: `--surface-raised` fill, `--text-secondary` text
- Accent (e.g. "active plan", a highlighted state): `--accent-subtle` fill, `--accent` text
- Status (error/success/warning): same low-opacity-fill + full-opacity-text recipe, using the existing status colors

**Tabs / nav**
- Inactive: `--text-secondary`
- Active: `--text` + `--accent` underline/indicator — the underline is the accent touch, not the text color

**Stat number (the big headline figure in a card)**
- Default: `--text`, full weight — most stats stay neutral, per both references
- Only bump a stat to `--accent` when it's genuinely the one figure the screen exists to show

---

## 7. What to change in the existing Less system

- Everything in §1–6 above lives in CSS custom properties, scoped to the dashboard app/layout — doesn't touch marketing's `@primary`/`@secondary` Less variables at all, so no risk of the two systems bleeding into each other.
- Base doc's own recommendation (§8, rename `@secondary` → `@surface`) is worth doing regardless, since you're introducing an actual `--surface` token here — keeping the old misleading name around next to the new correctly-named one would be confusing.
- `max(1px, @vw1)`, `max(1em, @vw16)`, the hover-only `@media (hover: hover)` gate, `:focus-visible` restoration, `transition-property` discipline — all carry over unchanged, they're not color concerns.

```css
:root,
[data-theme="dark"] {
  --background: #0A0A0C;
  --surface: #131316;
  --surface-raised: #1C1C20;
  --surface-hover: #1A1A1E;
  --border: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.14);
  --text: #F2F2F4;
  --text-secondary: rgba(255,255,255,0.58);
  --text-tertiary: rgba(255,255,255,0.38);
  --text-disabled: rgba(255,255,255,0.22);

  --accent: #7C5CFC;
  --accent-hover: #8F73FF;
  --accent-pressed: #6647E0;
  --accent-subtle: rgba(124,92,252,0.12);
  --accent-ring: rgba(124,92,252,0.28);
  --on-accent: #FFFFFF;

  --chart-bar: rgba(255,255,255,0.16);
  --chart-bar-hover: rgba(255,255,255,0.28);
  --chart-bar-highlight: var(--accent);
  --chart-grid: rgba(255,255,255,0.06);
  --chart-axis-text: var(--text-tertiary);
}

[data-theme="light"] {
  --background: #F7F7F8;
  --surface: #FFFFFF;
  --surface-raised: #F1F1F3;
  --surface-hover: #EFEFF1;
  --border: rgba(10,10,12,0.08);
  --border-strong: rgba(10,10,12,0.16);
  --text: #0A0A0C;
  --text-secondary: rgba(10,10,12,0.58);
  --text-tertiary: rgba(10,10,12,0.40);
  --text-disabled: rgba(10,10,12,0.24);

  --chart-bar: rgba(10,10,12,0.16);
  --chart-bar-hover: rgba(10,10,12,0.28);
  --chart-grid: rgba(10,10,12,0.06);
  /* accent tokens: identical to dark, inherited from :root */
}
```
