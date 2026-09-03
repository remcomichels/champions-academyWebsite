<template>
	<section :id="blok.anchor || undefined" v-editable="blok" data-scroll-inview class="section testimonials_block" aria-label="Member testimonials">
		<div class="container text-container">
			<p class="preTitle">{{ blok.pre_title }}</p>
			<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
			<h3 class="subTitle">{{ blok.sub_title }}</h3>
		</div>

		<div class="testimonials-marquee-group">
			<div
				ref="marqueeEl"
				class="testimonials-marquee"
				data-marquee-direction="left"
				data-marquee-status="normal"
				data-marquee-speed="30"
				:data-marquee-paused="marqueePaused ? 'true' : 'false'"
				@pointerenter="marqueePaused = true"
				@pointerleave="marqueePaused = false"
			>
				<div ref="scrollEl" class="marquee-scroll">
					<div ref="trackA" class="marquee-content" aria-hidden="false">
						<StoryblokComponent
							v-for="testimonialBlok in blok.testimonial"
							:key="`a-${testimonialBlok._uid}`"
							:blok="asBlok(testimonialBlok)"
						/>
					</div>

					<div ref="trackB" class="marquee-content" aria-hidden="true" inert>
						<StoryblokComponent
							v-for="testimonialBlok in blok.testimonial"
							:key="`b-${testimonialBlok._uid}`"
							:blok="asBlok(testimonialBlok)"
						/>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { TestimonialsBlockBlok } from "~/types/blocks";

defineProps<{ blok: TestimonialsBlockBlok }>();

// Pause the marquee while the pointer is over it (eased by useMarquee)
const marqueePaused = ref(false);

const marqueeEl = ref<HTMLElement | null>(null);
const scrollEl = ref<HTMLElement | null>(null);
const trackA = ref<HTMLElement | null>(null);
const trackB = ref<HTMLElement | null>(null);

useMarquee(marqueeEl, scrollEl, trackA, trackB);

const { initLetters, destroy } = useLetterAnimation();

onMounted(() => initLetters());
onUnmounted(() => destroy());
</script>
