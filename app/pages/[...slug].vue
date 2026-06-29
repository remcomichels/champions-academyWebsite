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
const baseTitle = "Nuxt 4 Boilerplate";
const siteDescription = 'Boilerplate made by Remco for Nuxt 4 projects, with Storyblok as headless CMS.';
const { url: siteUrl } = useSiteConfig();

// Homepage gets its own OG image; all other pages fall back to the default logo.
// Add public/images/og-home.png (1200×630 px recommended) for the homepage image.
const ogImageUrl = isHomePage
  ? `${siteUrl}/images/og-home.png`
  : `${siteUrl}/images/logo.png`;

useSeoMeta({
  title: () => {
    if (isHomePage) return `${baseTitle} | by Remco`;
    const slug = parts.at(-1) ?? "";
    const formatted = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return `${formatted} | ${baseTitle}`;
  },
  description: siteDescription,
  ogType: 'website',
  ogTitle: () => {
    if (isHomePage) return `${baseTitle} | by Remco`;
    const slug = parts.at(-1) ?? "";
    const formatted = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return `${formatted} | ${baseTitle}`;
  },
  ogDescription: siteDescription,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: () => {
    if (isHomePage) return `${baseTitle} | by Remco`;
    const slug = parts.at(-1) ?? "";
    const formatted = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return `${formatted} | ${baseTitle}`;
  },
  twitterDescription: siteDescription,
  twitterImage: ogImageUrl,
});

// --- Storyblok fetch (reactive to locale & route) ---
const resolveRelations = [];
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
