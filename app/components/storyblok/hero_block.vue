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
                <!-- The name goes on the h1 because the line below it is split
                     into per-letter spans, which SplitText hides from assistive
                     tech. It cannot put the text back on that <span> itself:
                     aria-label is prohibited on a generic element and is
                     ignored there, which left this h1 announcing only its
                     second word. `data-letters-aria="hidden"` stops SplitText
                     labelling the span at all, and this carries the full
                     headline instead. -->
				<h1 class="title-container" :aria-label="`${blok.title} ${blok.sub_title}`">
                    <span data-letters data-letters-aria="hidden" class="title"> {{ blok.title }} </span>
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