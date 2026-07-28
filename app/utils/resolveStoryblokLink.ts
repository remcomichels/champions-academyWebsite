import type { StoryblokMultilink } from "~/types/storyblok";

export const resolveStoryblokLink = (
	link?: StoryblokMultilink,
): string | null => {
	if (!link) return null;

	const raw = link.url || link.cached_url || "";

	// Storyblok stores the link field's "Anchor" input separately, without the #.
	const anchor = link.anchor?.trim().replace(/^#+/, "");
	const hash = anchor ? `#${anchor}` : "";

	// Anchor with no story/url selected means "a section on the current page".
	if (!raw) return hash || null;

	if (link.linktype === "story") {
		const cleaned = raw.replace(/^\/+|\/+$/g, "");
		const path = cleaned === "" || cleaned === "home" ? "/" : `/${cleaned}`;
		return `${path}${hash}`;
	}

	if (link.linktype === "email") {
		return raw.startsWith("mailto:") ? raw : `mailto:${raw}`;
	}

	// External urls may already carry their own hash — don't double up.
	return raw.includes("#") ? raw : `${raw}${hash}`;
};
