<template>
	<section :id="blok.anchor || undefined" v-editable="blok" data-scroll-inview class="section hero_block">
		<NuxtHeroLogo />
		<div class="container hero-container">
			<div class="text-container">
                <div class="preText-container">
                    <p class="preText">{{ blok.pre_text_line }}</p>
                </div>
                <!-- One h1 across both lines: the headline reads "Champions
                     Academy", and it used to be an h1 holding the first word
                     with an h3 under it — which put a one-word h1 on the page
                     and skipped a heading level. The spans keep both halves
                     styled exactly as they were. -->
				<h1 class="title-container">
                    <span data-letters class="title"> {{ blok.title }} </span>
                    <span class="subTitle">{{ blok.sub_title }}</span>
                </h1>
                <div class="subText-container">
                    <p class="subText">{{ blok.text }}</p>
                </div>
			</div>
            <div v-if="blok.button?.length" class="button-container">
                <StoryblokComponent
                    v-for="buttonBlok in blok.button"
                    :key="buttonBlok._uid"
                    :blok="asBlok(buttonBlok)"
                />
            </div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { HeroBlockBlok } from "~/types/blocks";

defineProps<{ blok: HeroBlockBlok }>();

const { initLetters, destroy } = useLetterAnimation()

onMounted(() => {
	initLetters()
})

onUnmounted(() => {
  destroy()
})
</script>