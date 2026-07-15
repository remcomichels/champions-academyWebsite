<template>
	<section v-editable="blok" data-scroll-inview class="section paymentPlans_block">
		<div class="container paymentPlans-container">
			<div class="text-container">
				<p class="subTitle">{{ blok.sub_title }}</p>
				<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
			</div>

			<div v-if="blok.paymentCard?.length" class="cards-container">
				<StoryblokComponent
					v-for="cardBlok in blok.paymentCard"
					:key="cardBlok._uid"
					:blok="cardBlok"
				/>
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
