---
name: page-and-seo-patterns
description: >
  Enforces the SEO, meta tag, and page-level fetch conventions for this Nuxt 4 boilerplate. Use
  this skill any time you are: setting meta tags, writing OG image tags, adding Twitter cards,
  configuring page titles or descriptions, handling canonical URLs, working with the sitemap,
  configuring robots.txt or noindex rules, adding Schema.org / structured data, handling 404 or
  error pages, implementing preview/draft mode, activating the Storyblok bridge, or fetching a
  story in [...slug].vue. Also fire on phrases like "set up SEO for", "add Open Graph tags",
  "make this page indexable", "hide this from Google", "configure the sitemap", "add a sitemap
  entry", "robots.txt", "structured data", "canonical URL", "preview mode", "draft mode",
  "Storyblok bridge", "useHead", "useSeoMeta", "page not found", "404 page", "error page".
  CRITICAL: this boilerplate uses useSeoMeta — never useHead — for all SEO tags. useHead is
  Claude's training-data default and will produce wrong output here. Always reach for useSeoMeta
  first. Do NOT reimplement sitemap routes, robots middleware, or Schema.org by hand — the
  @nuxtjs/seo module handles all of these automatically from nuxt.config.ts.
---

# Page and SEO Patterns

This skill covers the conventions in `app/pages/[...slug].vue`, the `@nuxtjs/seo` module
configuration, and how SEO meta, robots, sitemaps, and Schema.org are managed in this boilerplate.
Many patterns here diverge from generic Nuxt training data — read before writing any meta tags.

---

## 1. useSeoMeta — always, never useHead

All SEO meta (title, description, OG tags, Twitter cards, canonical) goes through `useSeoMeta`.
This is the composable from `@nuxtjs/seo` that provides type-safe fields for every standard tag.

```ts
// ✅ Correct
useSeoMeta({
  title: 'My Page | Site Name',
  description: 'Page description',
  ogTitle: 'My Page | Site Name',
  ogDescription: 'Page description',
  ogImage: 'https://example.com/images/og.png',  // absolute URL
  twitterCard: 'summary_large_image',
})

// ❌ Wrong — useHead is what Claude defaults to from training data
useHead({
  title: 'My Page',
  meta: [{ property: 'og:image', content: '/images/og.png' }],
})
```

`useHead` still works for non-SEO head elements (favicon links, color-scheme meta, manifests).
The rule is specifically for SEO-relevant tags: use `useSeoMeta` for those.

---

## 2. Title format

The pattern from `[...slug].vue`:

```
Inner pages:  [Page Name] | [baseTitle]
Homepage:     [baseTitle] | by Remco
```

`Page Name` is derived from the last URL segment: hyphens replaced with spaces, each word
title-cased. `baseTitle` is a local constant — it is **not** read from `useSiteConfig()` or
`useAppConfig()`. The site-level `titleTemplate` in `nuxt.config.ts` is set to `'%s'` (passthrough),
so the page is responsible for including the site name in the string — it is not appended automatically.

When adding SEO for a new page context, mirror this pattern. Don't rely on `titleTemplate` to
append the site name for you — it won't.

---

## 3. The full [...slug].vue SEO and fetch flow

This is the exact pattern used in `app/pages/[...slug].vue`. Reference it rather than
reconstructing from scratch:

```vue
<script setup>
const route = useRoute()
const { locale } = useI18n()

// Slug parsing
const slugParam = route.params.slug
const parts = Array.isArray(slugParam) ? slugParam : slugParam ? [slugParam] : []
const url = parts.length ? parts.join('/') : 'home'
const storySlug = url.replace(/^\/+|\/+$/g, '')
const isHomePage = parts.length === 0

// SEO — useSiteConfig() provides the absolute URL for OG images
const baseTitle = 'Your Site Name'
const siteDescription = 'Your site description.'
const { url: siteUrl } = useSiteConfig()
const ogImageUrl = `${siteUrl}/images/logo.png`  // absolute, from public/

const slug = parts.at(-1) ?? ''
const formatted = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

useSeoMeta({
  title: () => isHomePage ? `${baseTitle} | by Remco` : `${formatted} | ${baseTitle}`,
  description: siteDescription,
  ogType: 'website',
  ogTitle: () => /* same as title */,
  ogDescription: siteDescription,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: () => /* same as title */,
  twitterDescription: siteDescription,
  twitterImage: ogImageUrl,
})

// Draft vs published — single source of truth
const previewMode = import.meta.dev || route.query._storyblok !== undefined

const { story, error } = await useAsyncStoryblok(storySlug, {
  api: {
    version: previewMode ? 'draft' : 'published',
    language: locale.value,
  },
  bridge: { resolveRelations: [] },
})

// Error handling — always throw, never return blank
if (error.value) {
  throw createError({
    status: error.value.status || 500,
    statusMessage: error.value.message || 'Storyblok fetch error',
    fatal: true,
  })
}

if (!story.value) {
  throw createError({ status: 404, statusMessage: 'Page Not Found', fatal: true })
}

// Bridge — live-update in editor, only when in preview
onMounted(() => {
  if (previewMode && story.value?.id) {
    useStoryblokBridge(story.value.id, (updated) => { story.value = updated })
  }
})
</script>
```

---

## 4. OG image — must be an absolute URL

`useSeoMeta({ ogImage })` requires an absolute URL — relative paths like `/images/og.png` will
not work in most social scrapers.

Use `useSiteConfig()` to prefix the path:

```ts
const { url: siteUrl } = useSiteConfig()
const ogImageUrl = `${siteUrl}/images/logo.png`
```

`useSiteConfig()` returns the value of `site.url` from `nuxt.config.ts` (set via
`NUXT_PUBLIC_SITE_URL` env var). Place static OG images in `public/images/` and reference them
as `/images/filename.png` — the prefix makes them absolute.

Dynamic OG image generation (`@nuxtjs/og-image`) is disabled: `ogImage: { enabled: false }` in
`nuxt.config.ts`. Don't enable it without intentional decision — the current setup uses a static
default image with per-story override capability when Storyblok SEO fields are added.

---

## 5. Per-story SEO overrides from Storyblok

The boilerplate currently uses default SEO for all pages (slug-derived title, hardcoded description).
When a Storyblok story needs per-page SEO fields (title, description, OG image), add a `seo`
plugin field to the block in Storyblok, then consume it in `[...slug].vue`:

```ts
// After story is fetched, read the seo plugin object:
const seo = computed(() => story.value?.content?.seo ?? {})

useSeoMeta({
  title: () => seo.value.title || defaultTitle,
  description: () => seo.value.description || siteDescription,
  ogTitle: () => seo.value.og_title || seo.value.title || defaultTitle,
  ogDescription: () => seo.value.og_description || seo.value.description || siteDescription,
  ogImage: () => seo.value.og_image?.filename
    ? `${seo.value.og_image.filename}/m/1200x630`  // Storyblok image transform
    : ogImageUrl,  // fall back to absolute static URL
})
```

Fallback chain: per-story Storyblok field → site default → hardcoded fallback. Always make the
OG image URL absolute — either via `useSiteConfig().url` prefix for static images or the
Storyblok `filename` (which is already absolute, `https://a.storyblok.com/...`).

---

## 6. 404 and error handling

When Storyblok returns no story, throw — never render a blank page silently:

```ts
if (!story.value) {
  throw createError({ status: 404, statusMessage: 'Page Not Found', fatal: true })
}
```

`fatal: true` triggers Nuxt's error page immediately. For API errors from Storyblok:

```ts
if (error.value) {
  throw createError({
    status: error.value.status || 500,
    statusMessage: error.value.message || 'Storyblok fetch error',
    fatal: true,
  })
}
```

Both checks run before the template renders. The order matters: check `error` first (network/auth
failure), then `!story` (slug not found in CMS).

---

## 7. Draft vs published — one condition, everywhere

The flag that controls preview mode is:

```ts
const previewMode = import.meta.dev || route.query._storyblok !== undefined
```

- `import.meta.dev` — true in local development
- `route.query._storyblok !== undefined` — true when Storyblok injects its editor query param

Use this same expression in both the `useAsyncStoryblok` `version` field and the `onMounted`
bridge activation check. Don't derive it separately in two places, don't hardcode `'draft'`.

The bridge (`useStoryblokBridge`) is activated in `onMounted`, not at setup time, because it
requires the DOM. Guard it with `previewMode && story.value?.id`:

```ts
onMounted(() => {
  if (previewMode && story.value?.id) {
    useStoryblokBridge(story.value.id, (updated) => { story.value = updated })
  }
})
```

When the bridge is active, editing content in the Storyblok visual editor updates `story.value`
in real time without a page reload.

---

## 8. What @nuxtjs/seo handles automatically — don't reimplement

These are managed by the module and its config in `nuxt.config.ts`. Writing them manually is
both redundant and risky (manual versions may conflict with or override the module's output).

### Canonical URLs

`@nuxtjs/seo` automatically generates canonical tags based on the current route. Don't add
`<link rel="canonical">` via `useHead` or `useSeoMeta({ canonicalUrl })` manually unless you
have a specific override case (e.g., paginated pages pointing to page 1).

### Schema.org / structured data

The Organization schema is configured once in `nuxt.config.ts`:

```ts
schemaOrg: {
  identity: {
    type: 'Organization',
    name: 'Website Name',
    logo: '/images/logo.png',
    description: '...',
    telephone: '...',
    email: '...',
    address: { streetAddress, postalCode, addressLocality, addressCountry },
    sameAs: ['https://linkedin.com/...', 'https://instagram.com/...'],
  },
},
```

This emits the correct JSON-LD `<script>` tag on every page. To update organization details
(name, address, social links), edit this block. Do not write `<script type="application/ld+json">`
by hand anywhere else — the module handles it.

### Robots

Robots behavior is configured in `nuxt.config.ts`:

```ts
robots: {
  groups: [
    {
      userAgent: ['*'],
      disallow: process.env.NUXT_PUBLIC_SITE_URL === 'https://localhost:3000/'
        ? ['/api/']        // dev/local: allow crawlers, block only API
        : ['/'],           // any other URL: block all crawlers
    },
  ],
},
```

The current default **blocks all crawlers** (`Disallow: /`) whenever `NUXT_PUBLIC_SITE_URL` is
not set to `https://localhost:3000/`. This is intentional — a boilerplate should not accidentally
index before it's production-ready. To allow indexing in production, update this config block
(e.g., change the disallow to `['/api/']` for your production URL condition).

To block a specific path from indexing, add it to the `disallow` array — do not edit
`public/_robots.txt` directly. The module generates robots.txt dynamically from this config.

To noindex a single page, use `useSeoMeta({ robots: 'noindex, nofollow' })` in that page's
setup script.

### Sitemap

The sitemap is populated via a Nitro plugin hook at `server/plugins/sitemap.ts`. It uses the
`sitemap:resolved` hook to inject Storyblok story URLs at build/request time:

```ts
// server/plugins/sitemap.ts
nitroApp.hooks.hook('sitemap:resolved', async (ctx) => {
  const stories = await client.getAll('cdn/stories', { version: 'published' })

  stories
    .filter((story) => !EXCLUDED_SLUGS.includes(story.full_slug))
    .forEach((story) => {
      ctx.urls.push({
        loc: story.full_slug === 'home' ? '/' : `/${story.full_slug}`,
        lastmod: story.published_at ?? story.created_at,
      })
    })
})
```

`EXCLUDED_SLUGS` currently filters out `['config']` (the Storyblok config story). Add any
story slugs here that should not appear in the sitemap.

To add a non-Storyblok URL (a static or API-driven route), push it inside the same hook:
```ts
ctx.urls.push({ loc: '/my-custom-route', lastmod: new Date().toISOString() })
```

Do not create a separate `/api/__sitemap__/urls` endpoint — the Nitro plugin hook is the
established pattern here.

---

## 9. i18n

i18n is configured with a single locale (`en`) using `prefix_except_default` strategy — the
default locale has no URL prefix. There are no locale-specific SEO variants to manage yet. If
multi-locale is added later, `@nuxtjs/seo` handles hreflang tags automatically when the i18n
module is present; `sitemap.autoI18n` is currently `false` and should be enabled at that point.

---

## Related skills

- **Where [...slug].vue lives and "never create new pages"** → `code-structure-conventions`
- **Storyblok component registration, v-editable, block fetching** → `storyblok-patterns`
- **Styling the page** → `less-design-system`
- **Page entrance animations** → `animation-patterns`
