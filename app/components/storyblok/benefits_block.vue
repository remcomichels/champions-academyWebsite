<template>
	<section :id="blok.anchor || undefined" v-editable="blok" data-scroll-inview class="section benefits_block">
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
						:blok="asBlok(buttonBlok)"
					/>
				</div>
			</div>

			<NuxtBenefitsGrid v-if="benefits.length" :items="benefits" />
		</div>
	</section>
</template>

<script setup lang="ts">
import type { BenefitsBlockBlok } from "~/types/blocks";

import type { BenefitStoryRef } from "~/types/storyblok";

const props = defineProps<{ blok: BenefitsBlockBlok }>();

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
