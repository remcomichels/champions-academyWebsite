<script setup>
const route = useRoute();
const { locale } = useI18n();

// --- Safe slug parsing ---
const slugParam = route.params.slug;
const parts = Array.isArray(slugParam) ? slugParam : slugParam ? [slugParam] : [];

// Resulting path for Storyblok
const url = parts.length ? parts.join("/") : "home";
const storySlug = url.replace(/^\/+|\/+$/g, "");
const isHomePage = parts.length === 0;

// --- SEO ---
const baseTitle = "Champions Academy";
const homeTitle = "Champions Academy - the last membership you will ever need";
const siteDescription = "A trading community built on real education, live mentorship, and proven SMC strategy — as one connected system.";
const { url: siteUrl } = useSiteConfig();

// One card for every page. There was previously a per-page fallback to
// logo.png, which no longer exists — a broken OG image is worse than a
// slightly generic one, because scrapers cache the miss.
//
// The trailing slash matters: NUXT_PUBLIC_SITE_URL ends in one, so naive
// interpolation produced https://host//images/... Scrapers cache whatever URL
// they are first given, so a sloppy one is awkward to take back.
const ogImageUrl = `${siteUrl.replace(/\/+$/, "")}/images/og-image.png`;

// Home gets the full tagline; inner pages get "Page | Champions Academy",
// derived from the slug so a new CMS page needs no code change.
const pageTitle = () => {
  if (isHomePage) return homeTitle;
  const slug = parts.at(-1) ?? "";
  const formatted = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${formatted} | ${baseTitle}`;
};

useSeoMeta({
  title: pageTitle,
  description: siteDescription,
  ogType: 'website',
  ogTitle: pageTitle,
  ogDescription: siteDescription,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: siteDescription,
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
