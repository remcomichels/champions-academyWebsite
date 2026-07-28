import type { StoryblokMultilink } from '~/types/storyblok'

// ─────────────────────────────────────────────────────────────────────────────
// useStoryblokLink
//
// resolveStoryblokLink + i18n in one step. Returns a routable href for a
// multilink, running the path (and only the path) through localePath so a
// section anchor set in Storyblok's "Anchor" input survives — localePath would
// otherwise mangle or drop the #fragment.
// ─────────────────────────────────────────────────────────────────────────────

export function useStoryblokLink() {
  const localePath = useLocalePath()

  return (link?: StoryblokMultilink): string | null => {
    const href = resolveStoryblokLink(link)
    if (!href) return null

    // Same-page anchor — nothing to localize.
    if (href.startsWith('#')) return href

    // mailto:, tel:, external urls — leave untouched.
    if (!href.startsWith('/')) return href

    const hashIndex = href.indexOf('#')
    if (hashIndex === -1) return localePath(href)

    return `${localePath(href.slice(0, hashIndex))}${href.slice(hashIndex)}`
  }
}
