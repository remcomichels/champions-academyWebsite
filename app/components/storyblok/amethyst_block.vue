<template>
	<section v-editable="blok" data-scroll-inview class="section amethyst_block">
		<div class="container amethyst-container">
			<div class="text-container">
				<p class="subTitle">{{ blok.sub_title }}</p>
				<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
				<p class="text">{{ blok.text }}</p>

				<div v-if="blok.steps?.length" class="steps-container">
					<StoryblokComponent
						v-for="stepBlok in blok.steps"
						:key="stepBlok._uid"
						:blok="stepBlok"
					/>
				</div>

				<div v-if="blok.button?.length" class="button-container">
					<StoryblokComponent
						v-for="buttonBlok in blok.button"
						:key="buttonBlok._uid"
						:blok="buttonBlok"
					/>
				</div>
			</div>

			<div class="amethyst-video">
				<NuxtVideoPlayer v-if="blok.video_id" :video-id="blok.video_id" />
			</div>
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
