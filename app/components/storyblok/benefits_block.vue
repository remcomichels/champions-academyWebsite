<template>
	<section ref="root" v-editable="blok" data-scroll-inview class="section benefits_block">
		<div class="container benefits-container">
			<div class="text-container">
				<p class="subText">{{ blok.sub_text }}</p>
				<div class="title-container">
					<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
					<h3 class="subTitle">{{ blok.sub_title }}</h3>
				</div>
				<p class="text">{{ blok.text }}</p>
				<div v-if="blok.button?.length" class="button-container">
					<StoryblokComponent
						v-for="buttonBlok in blok.button"
						:key="buttonBlok._uid"
						:blok="buttonBlok"
					/>
				</div>
			</div>

			<div v-if="benefits.length" class="benefits-grid">
				<article v-for="story in benefits" :key="story.uuid" class="benefit-card">
					<h4 class="benefit-title">{{ story.name }}</h4>
				</article>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { BenefitStoryRef } from '~/types/storyblok'

const props = defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

// The `benefit` multi-options field stores story UUIDs; resolve_relations in
// [...slug].vue swaps them for full story objects. Skip any that stayed
// unresolved (raw UUID strings).
const benefits = computed<BenefitStoryRef[]>(() =>
	(props.blok.benefit ?? []).filter(
		(entry: unknown): entry is BenefitStoryRef => typeof entry === "object" && entry !== null,
	),
);

const { initLetters, destroy } = useLetterAnimation();

onMounted(() => initLetters());
onUnmounted(() => destroy());
</script>
