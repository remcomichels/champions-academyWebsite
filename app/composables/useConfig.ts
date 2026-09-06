import type { FooterMenu, MenuLinkItem, StoryblokMultilink } from "~/types/storyblok";

/**
 * The global Storyblok "config" story.
 *
 * One SSR-safe fetch shared by the header, the footer, and every managed CTA.
 * Previously this story was fetched twice, client-only, in two `onMounted`
 * hooks — so the header CTA never server-rendered at all and crawlers saw an
 * empty nav. The link swap needs the defaults during SSR, so that is fixed
 * here rather than worked around.
 */

export interface ConfigContent {
	header_menu?: MenuLinkItem[];
	cta_menu?: MenuLinkItem[];
	footer_menu?: FooterMenu[];
	/** Default checkout / contact links, used when no affiliate is referring. */
	default_lite?: StoryblokMultilink;
}

export function useConfig() {
	const storyblokApi = useStoryblokApi();
	const route = useRoute();

	// Match the catch-all page: draft in dev and inside the visual editor,
	// published everywhere else. Fetching draft in production would leak
	// unpublished nav changes to real visitors.
	const previewMode = import.meta.dev || route.query._storyblok !== undefined;

	const { data, error } = useAsyncData<ConfigContent | null>(
		// Fixed key so all callers in one request share a single fetch and one
		// payload entry, however many buttons are on the page.
		"storyblok-config",
		async () => {
			const { data } = await storyblokApi.get("cdn/stories/config", {
				version: previewMode ? "draft" : "published",
				resolve_links: "url",
			});
			return (data.story?.content ?? null) as ConfigContent | null;
		},
		{
			// A missing config story must not take the whole page down with it —
			// the nav degrades, the content still renders.
			default: () => null,
		},
	);

	if (error.value) {
		console.error("[useConfig] could not load the config story:", error.value);
	}

	return {
		config: data,
		headerMenu: computed(() => data.value?.header_menu ?? []),
		ctaMenu: computed(() => data.value?.cta_menu ?? []),
		footer: computed(() => data.value?.footer_menu?.[0] ?? null),
	};
}
