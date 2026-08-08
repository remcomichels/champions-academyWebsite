---
name: code-structure-conventions
description: >
  Enforces the file organization, naming, and import conventions for this Nuxt 4 boilerplate.
  Use this skill whenever you are: creating any new file (component, composable, plugin, utility,
  type, page, or server route); deciding where something should live; adding or consuming a global
  ($gsap, $lenis, $ScrollTrigger); refactoring file locations; scaffolding a new
  feature; or any time code is being organized. If the user asks "where should I put X",
  "how do I add X", or "create a new X", this skill must fire. Also use it when writing code
  that touches animations, scroll effects, or Supabase — those have specific import rules that
  differ from standard Nuxt practice (Supabase is server-only here: there is no $supabase).
---

# Code Structure Conventions

This skill captures the conventions that differ from generic Nuxt 4 defaults — things that would
be easy to get wrong without knowing how this boilerplate is actually wired.

---

## Directory map

```
app/
├── app.vue                  # Root — initialises global useState only, renders <NuxtLayout />
├── router.options.ts        # Router config (scroll behaviour etc.)
├── components/
│   ├── *.vue                # Auto-imported as <NuxtXxx /> (Nuxt prefix applied)
│   └── storyblok/           # Auto-imported globally, NO prefix — matched by Storyblok component name
├── composables/
│   └── useXxx.ts            # Auto-imported, useXxx naming required
├── layouts/
│   └── default.vue          # Wraps every page: NuxtHeader → NuxtPage → NuxtFooter
├── pages/
│   └── [...slug].vue        # THE ONLY PAGE — handles every URL via Storyblok
├── plugins/
│   └── *.client.ts          # Client-only (lenis, gsap, main, routeFocus)
├── middleware/
│   └── *.ts                 # Route middleware (auth, admin, guest)
├── types/
│   └── storyblok.ts         # Shared Storyblok types
├── utils/
│   └── *.ts                 # Pure functions — auto-imported, no Vue reactivity
└── assets/
    ├── js/
    │   ├── main.ts          # Global JS entry — export initGlobalInteractions() here
    │   └── components/
    │       └── <name>.ts    # Logic for ONE specific .vue component, named to match it
    └── less/                # Styling (separate skill)

public/                      # Static assets — NOT inside app/
shared/                      # Auto-imported into BOTH app and server (Nuxt 4)
└── utils/, types/           # Validators and types used on both sides
server/
├── api/                     # Server routes (/api/auth, /api/affiliate, /api/admin)
├── middleware/              # Nitro middleware (runs on every request)
├── plugins/
│   └── sitemap.ts           # Nitro server plugins
└── utils/                   # Server-only helpers — the Supabase client lives here
```

---

## Rules that are easy to get wrong

### 1. Never create new pages

`app/pages/[...slug].vue` handles every URL. Do NOT create `app/pages/about.vue`,
`app/pages/contact.vue`, etc. All content routing goes through Storyblok via the catch-all.

The only exception: Nuxt system routes like `/api/*` (server routes) or a dedicated
`/login` page that is not CMS-driven.

### 2. Component auto-import prefix

- `app/components/header.vue` → `<NuxtHeader />`
- `app/components/storyblok/Hero.vue` → `<Hero />` (no prefix, globally registered)

Never add `import Header from '~/components/header.vue'` — Nuxt handles it.

### 3. Consuming globals — never re-import

These are provided by plugins. Access them via `useNuxtApp()` — do not import the
libraries directly.

```ts
// ✅ Correct — in .vue files and layouts
const { $gsap, $ScrollTrigger, $lenis } = useNuxtApp()

// ❌ Wrong in .vue files — unsafe: .client.ts plugins don't run during SSR,
// so $gsap/$ScrollTrigger are undefined when useNuxtApp() is called in setup
import { gsap } from 'gsap'
import Lenis from 'lenis'
```

**Supabase is not a global and there is no `$supabase`.** It is server-only: import the
client from `server/utils/` inside a server route. Never import `@supabase/supabase-js`
in a `.vue` file, a composable, or anything under `app/` — the browser holds no Supabase
key and must not. Client code reaches data through `/api/*` routes.

**Exception — composables and plain TS modules import GSAP directly:**

```ts
// ✅ Correct in app/composables/ and app/assets/js/components/
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)  // idempotent, safe to call multiple times
```

Why: `useNuxtApp()` is not reliably available in composable setup contexts during SSR, and
`.client.ts` plugins don't run server-side anyway — so `$gsap` is undefined there. The direct
import uses ESM's singleton cache, so you get the same GSAP instance every time. This is the
safe path for composables and `assets/js/components/*.ts` helpers.

This does **not** apply to `$lenis` — that must always come from `useNuxtApp()`.
See the `animation-patterns` skill for the full GSAP import rule and why it works.

### 4. One-component JS: `app/assets/js/components/<name>.ts`

Logic that belongs exclusively to one `.vue` component lives here, named to match the component.
`header.ts` is the logic file for `header.vue`. `footer.ts` is for `footer.vue`. There is a
strict 1:1 relationship — if the same logic is needed in more than one component, it should
be a composable instead (see Rule 5).

The `.vue` file imports directly from this path:
```ts
// header.vue <script setup>
import { useHeader } from '~/assets/js/components/header'
const { headerMenu, ctaMenu } = useHeader()
```

`app/assets/js/main.ts` is the global entry point. Anything that should run on every page
gets called from `initGlobalInteractions()` there.

### 5. Composables vs one-component JS vs utils

The key question is **scope of reuse**:

| | `app/composables/` | `app/assets/js/components/` | `app/utils/` |
|---|---|---|---|
| Used by many components | ✅ | ❌ | ✅ |
| Used by exactly one component | ❌ | ✅ | — |
| Contains Vue reactivity | ✅ | ✅ | ❌ |
| Pure function, no Vue state | ❌ | ❌ | ✅ |
| Auto-imported by Nuxt | ✅ | ❌ (explicit import) | ✅ |

- `useLetterAnimation`, `useInview`, `useMarquee` → `composables/` — reused across many Storyblok components
- `useHeader` → `assets/js/components/header.ts` — only ever used by `header.vue`
- `resolveStoryblokLink` → `utils/` — pure string transform, no Vue state

### 6. Plugin file naming

- `.client.ts` suffix → runs on client only (lenis, gsap, main interactions, routeFocus)
- `.ts` (no suffix) → runs on both server and client

Every plugin in this project is currently `.client.ts`. Only drop the suffix when the plugin
genuinely must run during SSR, and never to reach a backend service — that belongs in a
server route.

### 7. Shared reactive state across components

Use `useState` (Nuxt's SSR-safe global ref) for state that must be shared between
unrelated components without a prop chain. Two built-in state keys:

```ts
const introComplete     = useState('introComplete', () => false)
const pageTransitioning = useState('pageTransitioning', () => false)
```

Composables read these to know when it is safe to run animations. Do not pass these as props.

### 8. TypeScript types

- Storyblok content types → `app/types/storyblok.ts`
- Types needed by both app and server → `shared/types/` (Nuxt 4 auto-imports both sides)
- Component-local types → top of the file they are used in
- Shared non-Storyblok types → `app/types/` with a descriptive filename

### 9. Static files

Anything in `public/` (images, fonts, manifests, robots) lives at the **project root**
`/public/`, not inside `app/`. Reference them as `/images/logo.png` etc.

### 10. Server-side code

Nitro plugins (e.g. sitemap generation) go in `server/plugins/`. Server API routes go in
`server/api/`. These are plain `.ts` files — no Vue imports.

---

## Related skills

When other skills also apply, defer to them for their domain:

- **LESS variables, vw units, and styling** → `less-design-system`
- **Storyblok component registration and `v-editable`** → `storyblok-patterns`
- **GSAP/Lenis composable patterns and ScrollTrigger lifecycle** → `animation-patterns`
