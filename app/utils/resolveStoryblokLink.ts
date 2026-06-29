import type { StoryblokMultilink } from "~/types/storyblok";

export const resolveStoryblokLink = (
	link?: StoryblokMultilink,
): string | null => {
	if (!link) return null;

	const raw = link.url || link.cached_url || "";
	if (!raw) return null;

	if (link.linktype === "story") {
		const cleaned = raw.replace(/^\/+|\/+$/g, "");
		return cleaned === "" || cleaned === "home" ? "/" : `/${cleaned}`;
	}

	if (link.linktype === "email") {
		return raw.startsWith("mailto:") ? raw : `mailto:${raw}`;
	}

	return raw;
};
