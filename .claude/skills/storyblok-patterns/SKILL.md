---
name: storyblok-patterns
description: >
  Enforces every Storyblok-specific convention for this Nuxt 4 boilerplate. Use this skill any
  time you are: creating or editing a Storyblok block component, fetching a story or config story,
  typing a blok prop, rendering rich text, handling a Storyblok image, resolving a multilink, or
  wiring up any CMS-driven content. Fire on user phrases like "create a hero block", "add a new
  section component", "fetch the about page", "render the menu", "render this image from
  Storyblok", "the content comes from the CMS", "add a CTA button from Storyblok", "display the
  footer links", or any mention of Storyblok blocks, stories, or bloks.
  CRITICAL rules baked in: (1) every Storyblok block component MUST have v-editable="blok" on its
  root element — omitting it silently breaks click-to-edit in the visual editor without any build
  error. (2) Filenames in app/components/storyblok/ must match the Storyblok block technical name
  exactly including case — Hero.vue not hero.vue — a mismatch makes <StoryblokComponent> render
  nothing silently. (3) Always use the auto-imported renderRichText() composable for rich text,
  never import richTextResolver from @storyblok/richtext directly.
---

# Storyblok Patterns

This skill covers the conventions that are specific to how Storyblok is wired into this
boilerplate. Many rules here fail silently — the app renders fine but something breaks in the
editor or the URL resolution comes out wrong. Read carefully before writing any CMS-related code.

---

## 1. What is auto-imported

`@storyblok/nuxt` auto-imports these composables — no import statement needed:

- `useAsyncStoryblok` — fetch a single story by slug (used in `[...slug].vue`)
- `useStoryblokApi` — direct API client for custom fetches (config stories, CDN queries)
- `useStoryblokBridge` — live-update bridge for the visual editor
- `renderRichText` — converts a Storyblok rich-text field object to an HTML string

The `@storyblok/nuxt` module also globally registers all components in
`app/components/storyblok/` without a prefix (see rule below about naming).

---

## 2. v-editable — the one rule you cannot skip

Every Storyblok block component must have `v-editable="blok"` on its **root element**. Without
it, clicking the component in the visual editor does nothing — there is no build error, no
console warning, and the page renders identically. The only symptom is a broken editing
experience.

```vue
<!-- ✅ Correct -->
<template>
  <section v-editable="blok">
    ...
  </section>
</template>

<!-- ❌ Wrong — editor can't click-to-edit this component -->
<template>
  <section>
    ...
  </section>
</template>
```

This applies to every component in `app/components/storyblok/` without exception — including
wrapper/layout blocks like `Page` and `Grid` that may not feel like "real" editor-editable content.

---

## 3. Component structure

### The blok prop

Every Storyblok component receives a single `blok` prop — the content object from the API.
Use this exact `defineProps` shape (copied from the actual components):

```vue
<script setup>
defineProps({
  blok: {
    type: Object,
    required: true,
  },
});
</script>
```

If you need TypeScript typing for the blok fields, define a per-component interface in
`app/types/storyblok.ts` and cast inside the component (the blok prop itself stays `Object`
because `StoryblokComponent` passes it as a plain object):

```ts
// app/types/storyblok.ts
export interface HeroBlok {
  _uid: string
  component: 'Hero'
  headline?: string
  subheadline?: string
  background_image?: StoryblokAsset
}
```

```vue
<script setup>
import type { HeroBlok } from '~/types/storyblok'

const props = defineProps({
  blok: { type: Object, required: true },
})

const blok = computed(() => props.blok as HeroBlok)
</script>
```

### Filename must match Storyblok's technical name exactly

The filename in `app/components/storyblok/` must match the block's **technical name** in
Storyblok exactly, including case. `Hero.vue` maps to a block named `Hero`. `hero.vue` maps to
`hero`. A mismatch causes `<StoryblokComponent>` to render nothing — silently.

Check the technical name (not the display name) in the Storyblok block library. When in doubt,
mirror the case of the block name verbatim.

### Full minimal component template

```vue
<template>
  <section v-editable="blok">
    <!-- component content -->
  </section>
</template>

<script setup>
defineProps({
  blok: {
    type: Object,
    required: true,
  },
});
</script>
```

No `<style>` block — styles live in `app/assets/less/components/<name>.less`, registered in
`main.less` (see `less-design-system` skill).

---

## 4. Nested bloks

When a block contains an array of child blocks (e.g. a `Page` block with a `body` array, or a
`Grid` with a `columns` array), render them with `<StoryblokComponent>`:

```vue
<template>
  <div v-editable="blok">
    <StoryblokComponent
      v-for="nestedBlok in blok.body"
      :key="nestedBlok._uid"
      :blok="nestedBlok"
    />
  </div>
</template>
```

- Always use `:key="nestedBlok._uid"` — `_uid` is the unique identifier Storyblok assigns each block.
- The child array field name (`body`, `columns`, `items`, etc.) comes from the block schema in
  Storyblok — check the field name there.
- `<StoryblokComponent>` looks up the registered component by `nestedBlok.component` and renders
  it. Each child component must itself have `v-editable`.

---

## 5. Images

Use `<NuxtAppImage>` — never `<NuxtImg>` or `<img>` directly. The wrapper applies the Storyblok
provider, WebP format, and SVG bypass automatically. Full patterns (v-if guard, alt fallback chain,
sizes strings, static file references) are in the `image-and-media-patterns` skill.

---

## 6. Multilink resolution

Storyblok multilink fields can be of type `story`, `url`, `email`, or `asset`. Use the
`resolveStoryblokLink` utility (auto-imported from `app/utils/`) to convert any multilink to an
`href` string:

```ts
const href = resolveStoryblokLink(blok.cta_link) // returns string | null
```

`resolveStoryblokLink` is auto-imported from `app/utils/` by Nuxt — no import statement needed in
`.vue` files or composables.

What it handles:
- `story` — strips leading/trailing slashes, returns `/` for home
- `email` — prepends `mailto:` if missing
- `url` / `asset` — returns the raw URL as-is

Always guard the result before rendering a link:

```vue
<NuxtLink v-if="href" :to="href">{{ blok.cta_label }}</NuxtLink>
```

The type `StoryblokMultilink` is in `app/types/storyblok.ts` if you need to annotate a blok
interface field.

---

## 7. Rich text

Use `renderRichText` (auto-imported from `@storyblok/nuxt`) to convert a rich-text field to
HTML, then bind it with `v-html`:

```vue
<template>
  <div v-editable="blok">
    <div v-html="bodyHtml" />
  </div>
</template>

<script setup>
const props = defineProps({ blok: { type: Object, required: true } })
const bodyHtml = computed(() => renderRichText(props.blok.body))
</script>
```

- `renderRichText` returns an empty string when the field is undefined or empty — no null guard needed.
- There are no custom mark/block resolvers in this boilerplate yet. If a future requirement needs
  custom rendering (e.g. a custom `code` block renderer), add a resolver object as the second
  argument to `renderRichText`.
- Wrap the `v-html` in a semantically appropriate container — `<div>`, `<article>`, etc. Don't
  apply `v-html` directly to a styled element that also has its own children.

---

## 8. Fetching global / config stories

Site-wide content (navigation, footer links, site settings) lives in a Storyblok story at
`cdn/stories/config`. Fetch it using `useStoryblokApi()` inside an `onMounted` hook, scoped to a
composable or component that owns that data:

```ts
// app/assets/js/components/footer.ts (example)
import { useStoryblokApi } from '#imports'

export function useFooter() {
  const storyblokApi = useStoryblokApi()
  const socialLinks = ref([])

  onMounted(async () => {
    try {
      const { data } = await storyblokApi.get('cdn/stories/config', {
        version: 'draft',
        resolve_links: 'url',
      })
      socialLinks.value = data.story.content.social_links ?? []
    } catch (error) {
      console.error('Error fetching config:', error)
    }
  })

  return { socialLinks }
}
```

Key details copied from the actual `header.ts` implementation:
- `useStoryblokApi` is imported from `'#imports'` (not from `'@storyblok/nuxt'`) inside
  `app/assets/js/components/` files, which are plain TS modules where Nuxt auto-imports aren't
  available.
- `version: 'draft'` is used here because this fetch runs on the client after mount; it always
  gets the latest content regardless of preview mode.
- `resolve_links: 'url'` resolves internal story links to their URL so `cached_url` is populated.
- Destructure the content fields you need from `data.story.content`.
- This pattern belongs in `app/assets/js/components/<name>.ts` if the data is exclusive to one
  component, or a composable if shared. See `code-structure-conventions` skill for the decision.

---

## 9. Page story fetching (already handled)

The catch-all page at `app/pages/[...slug].vue` handles all story fetching for routed pages. You
should not need to replicate this pattern — it uses `useAsyncStoryblok` with draft/published
version switching, locale, and bridge activation. Read that file directly if you need to
understand the full flow.

The version logic: `import.meta.dev || route.query._storyblok !== undefined` → draft; otherwise
published. The bridge (live updates in the editor) is activated in `onMounted` when this
condition is true.

---

## 10. Types

Shared Storyblok types live in `app/types/storyblok.ts`. Existing types:

- `StoryblokMultilink` — multilink field (`linktype`, `url`, `cached_url`, `id`)
- `StoryblokAsset` — asset field (`filename`, `alt`, `name`, `title`, `id`)
- `StoryblokLinkType` — `"story" | "url" | "email" | "asset"`
- `MenuLinkItem` — a `menu_link` block with `label` and `link` fields
- `LogoItem` — a `logo` block with a `logo` asset field

Add per-component blok interfaces here when you need to type a component's blok fields. Name
them `<BlockName>Blok` (e.g. `HeroBlok`, `CardBlok`).

---

## Related skills

- **File locations and naming** → `code-structure-conventions`
- **Styling Storyblok components** → `less-design-system`
- **Animations on Storyblok blocks** → `animation-patterns`
