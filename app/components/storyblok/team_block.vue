<template>
	<section :id="blok.anchor || undefined" v-editable="blok" data-scroll-inview class="section team_block">
		<div class="container team-container">
			<div class="text-container">
				<p class="subTitle">{{ blok.sub_title }}</p>
				<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
			</div>

			<div class="cards-container">
				<div v-if="blok.teamCard?.length" class="team-cards-column">
					<StoryblokComponent
						v-for="teamCardBlok in blok.teamCard"
						:key="teamCardBlok._uid"
						:blok="teamCardBlok"
					/>
				</div>

				<article class="text-card">
					<h3 class="text-card-title">{{ blok.textCard_title }}</h3>
					<div class="text-card-body" v-html="textCardHtml" />
				</article>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
const props = defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

// renderRichText is HTML-safe (Storyblok escapes text nodes) and resolves
// bold marks to <strong> and hard breaks to <br>.
const textCardHtml = computed(() => renderRichText(props.blok.textCard_textArea));

const { initLetters, destroy } = useLetterAnimation();

onMounted(() => initLetters());
onUnmounted(() => destroy());
</script>
