<script setup>
import { isPageStory } from "#shared/utils/storyblok";

const route = useRoute();
const { locale } = useI18n();

// --- Safe slug parsing ---
const slugParam = route.params.slug;
const parts = Array.isArray(slugParam) ? slugParam : slugParam ? [slugParam] : [];

// Resulting path for Storyblok
const url = parts.length ? parts.join("/") : "home";
const storySlug = url.replace(/^\/+|\/+$/g, "");

// --- SEO ---
const baseTitle = "Champions Academy";
const siteDescription = "A trading community built on real education, live mentorship, and proven SMC strategy — as one connected system.";

// Per-page copy, keyed by Storyblok slug. Only routable pages need an entry —
// the /benefits/* stories are items resolved into the benefits block, not
// pages, and are kept out of the sitemap for that reason.
//
// Anything missing falls through to the slug-derived title and the site
// description, so a new CMS page still needs no code change; it just reads
// generically until someone writes it something here.
const pageMeta = {
  home: {
    title: "Champions Academy - the last membership you will ever need",
    description: siteDescription,
  },
  benefits: {
    title: `Benefits | ${baseTitle}`,
    description:
      "Every benefit inside Champions Academy: FX signals and outlooks, the education library, the AI suite, instant funding and a community that trades together.",
  },
};

const { url: siteUrl } = useSiteConfig();

// One card for every page. There was previously a per-page fallback to
// logo.png, which no longer exists — a broken OG image is worse than a
// slightly generic one, because scrapers cache the miss.
//
// The trailing slash matters: NUXT_PUBLIC_SITE_URL ends in one, so naive
// interpolation produced https://host//images/... Scrapers cache whatever URL
// they are first given, so a sloppy one is awkward to take back.
const ogImageUrl = `${siteUrl.replace(/\/+$/, "")}/images/og-image.png`;

// A listed page gets its own title; anything else gets "Page | Champions
// Academy", derived from the slug. The derivation title-cases each word, so it
// gets acronyms wrong ("Ai Suite") — a page whose name needs better than that
// belongs in pageMeta.
const pageTitle = () => {
  const meta = pageMeta[storySlug];
  if (meta) return meta.title;
  const slug = parts.at(-1) ?? "";
  const formatted = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${formatted} | ${baseTitle}`;
};

const pageDescription = () => pageMeta[storySlug]?.description ?? siteDescription;

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogType: 'website',
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: ogImageUrl,
});

// --- Storyblok fetch (reactive to locale & route) ---
const resolveRelations = ["benefits_block.benefit"];
const previewMode = import.meta.dev || route.query._storyblok !== undefined

const { story, error } = await useAsyncStoryblok(
	storySlug,
	{
		api: {
			version: previewMode ? 'draft' : 'published',
			language: locale.value,
			...(resolveRelations.length ? { resolve_relations: resolveRelations } : {}),
		},
		bridge: {
			resolveRelations,
		},
	},
	
);

if (error.value) {
	throw createError({
		status: error.value.status || 500,
		statusMessage: error.value.message || "Storyblok fetch error",
		fatal: true,
	});
}

if (!story.value) {
	throw createError({
		status: 404,
		statusMessage: "Page Not Found",
		fatal: true,
	});
}

// Found, but not a page. A `benefit` story reached directly rendered a 200
// with an empty <main> — worse than a 404, because a crawler that finds the
// URL will happily index the emptiness. Same list the sitemap filters on.
if (!isPageStory(story.value.content?.component)) {
	throw createError({
		status: 404,
		statusMessage: "Page Not Found",
		fatal: true,
	});
}

provide("storyblok-story", story);

// --- Storyblok Bridge (optional: only in preview or dev) ---
onMounted(() => {
	if (previewMode && story.value?.id) {
		useStoryblokBridge(story.value.id, (updated) => {
			story.value = updated;
		});
	}
});
</script>

<template>
	<StoryblokComponent
		v-if="story"
		:blok="story.content"
	/>
</template>
