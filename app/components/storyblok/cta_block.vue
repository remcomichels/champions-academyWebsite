<template>
	<section :id="blok.anchor || undefined" v-editable="blok" data-scroll-inview class="section cta_block">
		<NuxtCtaFigure class="cta-figure-layer" />

		<div class="container cta-container">
			<p class="subText">{{ blok.sub_text }}</p>

			<div class="title-container">
				<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
				<h3 class="subTitle">{{ blok.sub_title }}</h3>
			</div>

			<div v-if="blok.button?.length" class="button-container">
				<StoryblokComponent
					v-for="buttonBlok in blok.button"
					:key="buttonBlok._uid"
					:blok="buttonBlok"
				/>
			</div>

			<p v-if="blok.text" class="text">{{ blok.text }}</p>
		</div>
	</section>
</template>

<script setup lang="ts">
defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

const { initLetters, destroy } = useLetterAnimation();

onMounted(() => initLetters());
onUnmounted(() => destroy());
</script>
