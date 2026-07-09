<template>
	<section v-editable="blok" data-scroll-inview class="section hero_block">
		<div class="container hero-container">
			<div class="text-container">
                <div class="preText-container">
                    <p class="preText">{{ blok.pre_text_line }}</p>
                </div>
				<div class="title-container">
                    <h1 data-letters class="title"> {{ blok.title }} </h1>
                    <h3 class="subTitle">{{ blok.sub_title }}</h3>
                </div>
                <div class="subText-container">
                    <p class="subText">{{ blok.text }}</p>
                </div>
			</div>
            <div v-if="blok.button?.length" class="button-container">
                <StoryblokComponent
                    v-for="buttonBlok in blok.button"
                    :key="buttonBlok._uid"
                    :blok="buttonBlok"
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

const { initLetters, destroy } = useLetterAnimation()

onMounted(() => {
	initLetters()
})

onUnmounted(() => {
  destroy()
})
</script>

<style lang="less">
@import "~/assets/less/components/hero_block.less";
</style>
