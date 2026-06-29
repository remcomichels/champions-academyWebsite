<template>
	<section v-editable="blok" class="hero">
		<NuxtAppImage
			v-if="blok.background_image?.filename"
			:src="blok.background_image.filename"
			:alt="blok.background_image.alt || ''"
			class="hero__bg"
			sizes="sm:580px md:1080px lg:1440px"
			:width="1920"
			:height="1080"
			fetchpriority="high"
			preload
		/>
		<div class="container hero__content">
			<div>
				<h1>{{ blok.headline }}</h1>
				<h2>{{ blok.subheadline }}</h2>
			</div>
		</div>
	</section>
</template>

<script setup>
defineProps({
	blok: {
		type: Object,
		required: true,
	},
});
</script>

<style scoped lang="less">
.hero {
	position: relative;
	overflow: hidden;

	&__bg {
		.absolute();
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		z-index: 0;
	}

	&__content {
		position: relative;
		z-index: 1;
	}
}
</style>
