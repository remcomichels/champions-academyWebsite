# Nuxt 4 Boilerplate

Nuxt 4 starter with Storyblok as the CMS, Supabase for auth/database, a LESS design system with
viewport-unit constants, GSAP + Lenis for animations, and `@nuxtjs/seo` for SEO and sitemap.
All page content is CMS-driven via a catch-all `[...slug].vue` route that fetches Storyblok stories.

## Stack

- **Nuxt 4** — framework, `app/` directory convention
- **Storyblok** (`@storyblok/nuxt`) — CMS; blocks render via `<StoryblokComponent>`
- **Supabase** (`@supabase/supabase-js`) — auth and database, **server-side only** via `server/utils/`; never imported in `.vue` files and no key is exposed to the browser
- **LESS** — styling; vw-unit constants + design tokens, no scoped styles in `.vue` files
- **GSAP + ScrollTrigger** — animations; `$gsap`/`$ScrollTrigger` in `.vue`, direct imports in composables
- **Lenis** — smooth scroll; `$lenis` plugin, standalone RAF loop
- **`@nuxt/image`** — responsive images via `<NuxtAppImage>` wrapper (never `<NuxtImg>` directly)
- **`@nuxtjs/seo`** — sitemap, robots, Schema.org, canonical; configured in `nuxt.config.ts`

## Structure

```
app/
  components/          # Regular components (prefix: Nuxt)
  components/storyblok/# Storyblok block components (no prefix)
  composables/         # Shared Vue composables
  assets/less/         # LESS design system (main.less is the entry point)
  assets/js/components/# Per-component TS logic (when script gets complex)
  pages/[...slug].vue  # Catch-all route — all CMS pages render here
  plugins/             # $gsap, $lenis — client-side only
  types/storyblok.ts   # Shared Storyblok blok interfaces
shared/                # Auto-imported into BOTH app and server (Nuxt 4)
server/plugins/        # Nitro plugins (sitemap hook)
server/utils/          # Server-only helpers — Supabase client lives here
public/images/         # Static assets — referenced as /images/<name>
.claude/skills/        # Project-specific Claude skills (see below)
```

## Available skills

These fire automatically when relevant — read them before writing code in their domain:

- **`code-structure-conventions`** — where files live, import rules, when to use composables vs component TS
- **`less-design-system`** — vw constants, design tokens, mixins, responsive breakpoints
- **`storyblok-patterns`** — block components, v-editable, rich text, multilink, config story fetching
- **`animation-patterns`** — GSAP/ScrollTrigger composables, Lenis, cleanup lifecycle, state gating
- **`page-and-seo-patterns`** — `useSeoMeta`, `[...slug].vue` fetch flow, sitemap, robots, draft mode
- **`component-creation`** — scaffold a new regular component or Storyblok block end-to-end
- **`image-and-media-patterns`** — `<NuxtAppImage>`, SVG bypass, alt fallback chain, sizes strings

## Commands

```bash
npm run dev        # HTTPS dev server (requires keys/localhost.pem + keys/localhost-key.pem)
npm run build      # Production build
npm run generate   # Static site generation
npm run preview    # Preview production build locally
```

## Environment variables

Set in `.env` (never commit). All are consumed via `nuxt.config.ts` runtime config.

| Variable | Purpose |
|---|---|
| `NUXT_PUBLIC_SITE_URL` | Canonical site URL; controls robots.txt (non-localhost blocks all crawlers) |
| `STORYBLOK_DELIVERY_API_TOKEN` | Storyblok CDN delivery token |
| `SUPABASE_URL` | Supabase project URL (server-side only) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (`sb_publishable_…`, replaces anon; RLS applies). Server-side only here — nothing in the browser talks to Supabase |
| `SUPABASE_SECRET_KEY` | Supabase secret key (`sb_secret_…`, replaces service_role; **bypasses RLS**). Never expose |
| `OTP_PEPPER` | HMAC pepper for invite-code hashes — `openssl rand -base64 48` |
| `VISIT_PEPPER` | Hash pepper for pseudonymous visitor fingerprints — `openssl rand -base64 48` |
| `BUNNY_STREAM_API_KEY` | Bunny Stream API key |
| `BUNNY_STREAM_LIBRARY_ID` | Bunny Stream library ID |
| `BUNNY_STREAM_HOSTNAME` | Bunny Stream pull zone hostname |
| `NUXT_PUBLIC_GOOGLE_ANALYTICS_ID` | GA4 measurement ID |

**Never put a secret in `runtimeConfig.public`.** Nuxt serialises that object into
`window.__NUXT__.config.public` in the SSR'd HTML of every page, and `nitro.routeRules['/**']`
caches that HTML at the CDN. Only `NUXT_PUBLIC_*` values belong there.

## Global conventions

- **Package manager**: `npm` (do not use pnpm or yarn)
- **TypeScript**: strict mode enforced via `vite-plugin-checker` + `vue-tsc`; no `any` without justification
- **No `<style>` blocks** in `.vue` files — all styles live in LESS files imported via `main.less`
- **No `useHead`** for SEO tags — use `useSeoMeta` (see `page-and-seo-patterns`)
- **No `<NuxtImg>` or `<img>`** in templates — use `<NuxtAppImage>` (see `image-and-media-patterns`)
