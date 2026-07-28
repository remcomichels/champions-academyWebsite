import type { StoryblokMultilink } from "~/types/storyblok";

// ─────────────────────────────────────────────────────────────────────────────
// storyblokLinkAttrs
//
// Turns the link field's open-in-new-tab toggle into anchor attributes.
// Storyblok stores it as target: "_blank"; the matching rel is added here so a
// new tab can't reach back into this one via window.opener.
//
// Usage:  <NuxtLink :to="href" v-bind="storyblokLinkAttrs(blok.link)">
// ─────────────────────────────────────────────────────────────────────────────

export const storyblokLinkAttrs = (
	link?: StoryblokMultilink,
): { target?: string; rel?: string } => {
	if (link?.target !== "_blank") return {};
	return { target: "_blank", rel: "noopener noreferrer" };
};
