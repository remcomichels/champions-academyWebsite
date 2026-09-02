<template>
	<section :id="blok.anchor || undefined" v-editable="blok" data-scroll-inview class="section benefitsOverview_block">
		<div class="container benefitsOverview-container">
			<div class="text-container">
				<p v-if="blok.sub_text" class="subText">{{ blok.sub_text }}</p>
				<div class="title-row">
					<h1 data-scroll-letters class="title">{{ blok.title }}</h1>
					<p v-if="benefits.length" class="benefits-count">
						<span class="benefits-count-number">{{ paddedCount }}</span>
						<span class="benefits-count-label">
							{{ benefits.length === 1 ? "benefit" : "benefits" }}
						</span>
					</p>
				</div>
			</div>

			<!-- Hover-only blob here: no self-wandering on the overview page -->
			<NuxtBenefitsGrid
				v-if="benefits.length"
				:items="benefits"
				:auto-wander="false"
				:heading-level="2"
			/>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { BenefitStoryRef } from "~/types/storyblok";

defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

// Every story in the Storyblok `benefits/` folder, in the folder's own order —
// adding a benefit in the CMS shows up here with no page edit. `is_startpage:
// false` drops the folder's own index story (this page).
const storyblokApi = useStoryblokApi();
const route = useRoute();
const { locale } = useI18n();
const previewMode = import.meta.dev || route.query._storyblok !== undefined;

const { data } = await useAsyncData(
	() => `benefits-overview-${locale.value}`,
	async () => {
		const { data } = await storyblokApi.get("cdn/stories", {
			starts_with: "benefits/",
			is_startpage: false,
			version: previewMode ? "draft" : "published",
			language: locale.value,
			sort_by: "position:asc",
			per_page: 100,
		});
		return (data.stories ?? []) as BenefitStoryRef[];
	},
	{ watch: [locale] },
);

const benefits = computed<BenefitStoryRef[]>(() =>
	// Belt-and-braces: never render the folder index as a card.
	(data.value ?? []).filter((story) => story.full_slug?.replace(/\/$/, "") !== "benefits"),
);

const paddedCount = computed(() => String(benefits.value.length).padStart(2, "0"));

const { initLetters, destroy } = useLetterAnimation();

onMounted(() => initLetters());
onUnmounted(() => destroy());
</script>
