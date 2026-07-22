<template>
	<section v-editable="blok" data-scroll-inview class="section faq_block">
		<div class="faq-container">
			<div class="container text-container">
				<p class="subTitle">{{ blok.sub_title }}</p>
				<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
				<p v-if="blok.text_line" class="text">{{ blok.text_line }}</p>
			</div>

			<div v-if="blok.faq_item?.length" class="faq-list container-narrow">
				<StoryblokComponent
					v-for="faqItemBlok in blok.faq_item"
					:key="faqItemBlok._uid"
					:blok="faqItemBlok"
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
