---
name: image-and-media-patterns
description: >
  Enforces the canonical image and media patterns for this Nuxt 4 boilerplate. Use this skill
  any time you are: adding an image to a template, rendering a Storyblok asset field, referencing
  a static file from public/images/, writing alt text, setting a sizes attribute, optimizing
  images for responsive layouts, handling SVG files, or transforming a Storyblok asset URL for
  OG/social images. CRITICAL: this boilerplate uses <NuxtAppImage> as the only image component —
  never <NuxtImg> or <img> directly in templates. Claude's training-data default is <NuxtImg>
  or <img>; always reach for <NuxtAppImage> instead. Fire on: "add an image", "use this logo",
  "render the hero image", "responsive image", "image from Storyblok", "SVG icon", "static image",
  "WebP", "alt text", "srcset", "sizes attribute", "optimize image", "lazy load", "picture element",
  "avatar image", "background image", "poster image", "NuxtImg".
---

# Image and Media Patterns

This boilerplate uses a single wrapper component, `<NuxtAppImage>`, for all image rendering in
templates. It handles SVG vs raster detection, applies Storyblok provider and WebP format defaults,
and passes all other attributes through transparently. Using `<NuxtImg>` or `<img>` directly in
templates bypasses these defaults and will produce inconsistent output.

---

## 1. The only image component: `<NuxtAppImage>`

`app/components/AppImage.vue` is registered as `<NuxtAppImage />` via the `prefix: "Nuxt"` config.
Use it for every image in every template — Storyblok assets, static files from `public/`, and SVGs.

```vue
<!-- Storyblok asset -->
<NuxtAppImage
  v-if="blok.image?.filename"
  :src="blok.image.filename"
  :alt="blok.image.alt || blok.image.name || 'Descriptive fallback'"
  sizes="580px sm:1080px md:1440px lg:1920px"
/>

<!-- Static file from public/images/ -->
<NuxtAppImage
  src="/images/logo.png"
  alt="Site logo"
  width="200"
  height="60"
/>

<!-- SVG from public/images/ — SVG bypass happens automatically -->
<NuxtAppImage
  src="/images/icon-arrow.svg"
  alt=""
  aria-hidden="true"
  width="24"
  height="24"
/>
```

**Why not `<NuxtImg>` directly?** The wrapper adds two defaults you'd have to repeat every time:
`provider="storyblok"` and `format="webp"`. It also handles the SVG bypass (see §2). Using
`<NuxtImg>` directly means forgetting one or both of those on every usage.

**Why not `<img>` directly?** For raster images, `<img>` skips the responsive srcset generation
that `@nuxt/image` provides. The exception is genuine inline SVG markup (`<svg>...</svg>`) — that
is not a file reference and is fine to use directly.

---

## 2. SVG bypass — why it works and when it applies

```vue
<!-- AppImage.vue — the actual implementation -->
<template>
  <img v-if="isSvg" v-bind="$attrs" :src="src">
  <NuxtImg v-else v-bind="$attrs" :src="src" provider="storyblok" format="webp" />
</template>

<script setup>
defineOptions({ inheritAttrs: false })
const props = defineProps({ src: { type: String, default: '' } })
const isSvg = computed(() => props.src?.toLowerCase().endsWith('.svg'))
</script>
```

Detection is by file extension (`.svg`, case-insensitive). When the src ends with `.svg`, the
component renders a plain `<img>` — no optimization pipeline. When it's anything else, it renders
`<NuxtImg>` with the Storyblok provider and WebP format baked in.

**Why bypass SVGs?** Running an SVG through `@nuxt/image` is wasteful (SVGs are already resolution-
independent) and can corrupt them (some image CDN providers re-encode SVGs as raster formats). The
bypass ensures SVGs are served as-is. You don't need to think about this — just use `<NuxtAppImage>`
with any src and the right path is chosen automatically.

All attributes (`class`, `width`, `height`, `aria-*`, `data-*`, style bindings) are forwarded to
whichever branch renders via `inheritAttrs: false` + `v-bind="$attrs"`.

---

## 3. Storyblok asset field pattern

The canonical shape for rendering a Storyblok image asset:

```vue
<NuxtAppImage
  v-if="blok.image?.filename"
  :src="blok.image.filename"
  :alt="blok.image.alt || blok.image.name || 'Descriptive fallback'"
  sizes="580px sm:1080px md:1440px lg:1920px"
/>
```

**Each piece matters:**

`v-if="blok.image?.filename"` — Storyblok empty asset fields are objects, not null. An unpopulated
asset field is `{}` with no `filename` property. Without this guard, `src` is `undefined` and
`@nuxt/image` throws. The `?.` handles cases where the field itself might be missing.

`:src="blok.image.filename"` — Use `.filename` directly. Storyblok asset URLs are already absolute
(`https://a.storyblok.com/f/.../image.jpg`). The Storyblok provider in `@nuxt/image` knows how to
append responsive transform parameters to these URLs.

`:alt="blok.image.alt || blok.image.name || 'Descriptive fallback'"` — Three-level fallback:
1. `blok.image.alt` — the alt text the editor set in Storyblok's asset manager (preferred)
2. `blok.image.name` — the filename without extension, auto-populated by Storyblok
3. A hardcoded string — for when both are empty; describe what the image shows in this context

Never leave alt empty unless the image is genuinely decorative (then use `alt=""` intentionally
and consider adding `role="presentation"`). Never hardcode alt over a real Storyblok value.

`sizes` — see §5 for the breakpoint mapping and canonical sizes strings.

---

## 4. Static images from `public/images/`

Files in `public/images/` are referenced by their path from the root — no `~/` or `@/` prefix:

```vue
<NuxtAppImage src="/images/logo.png" alt="Site logo" width="200" height="60" />
<NuxtAppImage src="/images/icon-arrow.svg" alt="" aria-hidden="true" width="24" height="24" />
```

The leading `/` is required. These go through the same `<NuxtAppImage>` wrapper as Storyblok assets
— the SVG bypass applies by extension, and non-SVG files are processed through `@nuxt/image` with
the Storyblok provider. For static files not hosted on Storyblok's CDN, `@nuxt/image` will serve
them as-is from the public directory (the provider is a hint, not a strict requirement for local
files).

Note on alt text: static files use a plain hardcoded string (`alt="Site logo"`) because there is
no Storyblok asset object with `.alt` and `.name` fields. The three-level fallback chain from §3
(`blok.image.alt || blok.image.name || 'fallback'`) is only for Storyblok asset fields — don't
apply it to `/public/` images.

---

## 5. The `sizes` attribute and breakpoint mapping

`@nuxt/image` is configured with three named breakpoints:

| Name | Width |
|------|-------|
| `sm` | 580px |
| `md` | 1080px |
| `lg` | 1440px |

The `sizes` attribute tells the browser which image size to request at each viewport width. Use
the breakpoint names in the `sizes` string so the generated srcset aligns with the configured
breakpoints.

**Real usage from `hero.vue`:**
```
sizes="580px sm:1080px md:1440px lg:1920px"
```
Read as: below 580px → request 580px image; at `sm` (580px+) → 1080px; at `md` (1080px+) → 1440px;
at `lg` (1440px+) → 1920px.

**Canonical sizes strings by image role:**

Full-bleed / hero (image spans full viewport width):
```
sizes="580px sm:1080px md:1440px lg:1920px"
```

Content-width (inside a container with max-width, roughly 70–80% of viewport):
```
sizes="580px sm:800px md:1100px"
```

Half-width / 2-column grid:
```
sizes="580px sm:540px md:720px"
```

Thumbnail / avatar (fixed size, never scales with viewport):
```
width="80" height="80"
```
Omit `sizes` entirely — it generates a single optimised image, which is exactly what you want.

Logo / fixed-width UI element:
```
width="200" height="60"
```
For fixed-size images that never change with viewport, `width` + `height` without `sizes` is
cleaner than a sizes string — `@nuxt/image` generates a single optimized size.

---

## 6. Storyblok URL transformations (for OG images and fixed-size outputs)

For images that go through `@nuxt/image` in templates, let the library handle responsive variants.
For images that bypass the library — OG images, email-bound images, social cards — use Storyblok's
native URL transform syntax directly:

```
https://a.storyblok.com/f/{space}/{path}/m/1200x630
```

Append `/m/<width>x<height>` to the `.filename` value. Examples:

```ts
// OG image at social-card dimensions
const ogImage = `${blok.seo_image.filename}/m/1200x630`

// Thumbnail at fixed square
const thumb = `${blok.avatar.filename}/m/80x80`

// Width-only resize (height auto)
const banner = `${blok.banner.filename}/m/1440x0`
```

These transformed URLs are already absolute and suitable for `useSeoMeta({ ogImage })` without
any additional prefix. For in-template images, prefer `<NuxtAppImage>` with a `sizes` string over
manual URL transforms — the library produces better srcsets.

---

## 7. Alt text rules

- Pull from `blok.image.alt` first — it's what the editor explicitly set
- Fall back to `blok.image.name` — Storyblok auto-populates this from the filename
- Add a hardcoded last-resort that describes what the image shows in this specific context
- For decorative images (purely visual, no information content): `alt=""` explicitly — this signals
  to screen readers that the image can be skipped
- Never `alt` the URL or filename itself (e.g., `alt="hero-bg-2024.jpg"`)

---

## 8. Video / Bunny Stream

No video components or HLS patterns exist in this codebase yet. Bunny Stream or `<video>` usage
is out of scope for this skill — document it when the pattern is established.

---

## What this skill does NOT cover

- `v-editable`, `defineProps`, block registration → `storyblok-patterns`
- OG meta tag wiring (`useSeoMeta({ ogImage })`) → `page-and-seo-patterns`
- CSS sizing of image containers, `object-fit`, aspect-ratio boxes → `less-design-system`
- Where `AppImage.vue` lives as a file → `code-structure-conventions`
