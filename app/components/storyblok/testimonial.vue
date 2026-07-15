<template>
	<article v-editable="blok" class="testimonial">
		<div class="testimonial-video">
			<NuxtVideoPlayer v-if="blok.video_id" :video-id="blok.video_id" />
		</div>

		<div class="testimonial-meta">
			<p class="testimonial-name">{{ blok.name }}</p>
			<NuxtAppImage
				v-if="flagSrc"
				:src="flagSrc"
				:alt="`Flag of ${country}`"
				class="testimonial-flag"
			/>
		</div>

		<p class="testimonial-text">{{ blok.text }}</p>
	</article>
</template>

<script setup lang="ts">
const props = defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

// The country field is a multi-option — Storyblok stores it as an array
const country = computed<string>(() => props.blok.country?.[0] ?? "");
const flagSrc = computed(() => resolveCountryFlag(country.value));
</script>
