---
name: component-creation
description: >
  Orchestrates the full sequence for creating a new component in this Nuxt 4 boilerplate. Use
  this skill any time you are creating, adding, scaffolding, or building a new component or
  block — even if the user doesn't say "component" explicitly. Fire on phrases like: "create a
  hero block", "add a navigation component", "build a card", "make a testimonial block", "scaffold
  a pricing section", "new Storyblok block", "add a footer", "create a CTA component", "make a
  custom cursor", "I need a new section for X". This skill is for new components only — editing
  existing ones goes directly to the convention skills. When fired, also consult
  code-structure-conventions, less-design-system, and (for Storyblok blocks) storyblok-patterns
  for the detailed rules behind each step.
---

# Component Creation Workflow

Two paths depending on what you're building. Answer the decision question first, then follow the
numbered steps for that path. Don't skip steps — the silent failures all come from incomplete runs.

---

## Decision: regular component or Storyblok block?

**Regular component** (`app/components/`) — if any of these are true:
- It's a UI primitive reused across many places (button, icon, cursor, modal)
- It's a layout shell rendered unconditionally (header, footer, layout wrapper)
- Its content is hardcoded or comes from props passed by Vue parents, not the CMS

**Storyblok block** (`app/components/storyblok/`) — if any of these are true:
- Its content is edited by someone in the Storyblok visual editor
- It maps to a content type defined in the Storyblok block library
- The user uses words like "block", "section", or "CMS component"
- It will be rendered via `<StoryblokComponent :blok="...">` somewhere

When genuinely ambiguous, ask: "Will an editor be configuring the content of this in Storyblok?"

---

## Path A — Regular component

**1. Create the Vue file**

`app/components/<name>.vue` — kebab-case filename.

```vue
<template>
  <div class="my-component">
    <!-- content -->
  </div>
</template>

<script setup>
// Component logic here.
// If the logic grows beyond a few lines, consider moving it to
// app/assets/js/components/my-component.ts (see code-structure-conventions §4)
</script>
```

No `<style>` block. Styles live in the LESS file (next step).

The filename is kebab-case **without** the `Nuxt` prefix — `my-component.vue`, not `nuxt-my-component.vue`.
The `Nuxt` prefix is added by nuxt.config (`prefix: "Nuxt"`), so `my-component.vue` auto-imports as
`<NuxtMyComponent />`. Putting `Nuxt` in the filename itself would double-prefix to `<NuxtNuxtMyComponent />`.

**2. Create the LESS file**

`app/assets/less/components/<name>.less` — same kebab-case as the Vue file.

```less
.my-component {
  // Use @vwN constants for all sizing, design tokens for all colors.
  // See less-design-system for the full token and vw reference.
}
```

**3. Register the LESS file**

Add one line to `app/assets/less/main.less`:

```less
@import './components/my-component.less';
```

Append after the existing component imports.

---

## Path B — Storyblok block component

**1. Confirm the technical name in Storyblok**

Open the Storyblok block library and check the **technical name** field (not the display name).
The filename must match it exactly, including case. `hero` → `hero.vue`. `Hero` → `Hero.vue`.
A mismatch makes `<StoryblokComponent>` render nothing — silently.

**2. Create the Vue file**

`app/components/storyblok/<TechnicalName>.vue`

Minimal scaffold — no nested bloks:

```vue
<template>
  <section v-editable="blok">
    <!-- render blok fields here, e.g. {{ blok.headline }} -->
  </section>
</template>

<script setup>
defineProps({
  blok: {
    type: Object,
    required: true,
  },
})
</script>
```

If the block contains a body array of child blocks (like the `page` block), render them with
`StoryblokComponent`:

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

<script setup>
defineProps({
  blok: {
    type: Object,
    required: true,
  },
})
</script>
```

`v-editable="blok"` must be on the **root element**. Without it, clicking the component in the
visual editor does nothing — no error, no warning, just a broken editing experience.

No `<style>` block. Styles go in the LESS file.

**3. Create the LESS file**

`app/assets/less/components/<name>.less` — always kebab-case regardless of the Vue filename case.
`Hero.vue` → `hero.less`. `MySection.vue` → `my-section.less`.

```less
.my-section {
  // vw constants for sizing, design tokens for colors — see less-design-system
}
```

**4. Register the LESS file**

Add one line to `app/assets/less/main.less`:

```less
@import './components/my-section.less';
```

---

## Verification checklist

Run through this after creating any component. Every item here is a silent failure — nothing
breaks loudly, the page just doesn't work right:

- [ ] **Storyblok filename case matches the technical name exactly** — `hero` ≠ `Hero`
- [ ] **`v-editable="blok"` is on the root element** — not a child element, not missing
- [ ] **LESS file exists** at `app/assets/less/components/<name>.less`
- [ ] **LESS file is imported** in `main.less` — easy to forget after creating the file
- [ ] **No `<style>` block in the `.vue` file** — causes CSS duplication in the production bundle
  (exception: a single component-local rule that is genuinely not shareable, like a dynamic
  class applied via `:class` that has no meaningful name)

---

## When the scaffold needs more than boilerplate

Once the files are created, the actual content work draws on the other skills:

- **LESS tokens, vw constants, sizing, mixins** → `less-design-system`
- **Storyblok rich text, images, multilinks, nested bloks, TypeScript typing** → `storyblok-patterns`
- **Scroll animations, GSAP, composables** → `animation-patterns`
- **Where to put one-component JS logic vs composables** → `code-structure-conventions`
- **SEO meta for a page-level block** → `page-and-seo-patterns`
