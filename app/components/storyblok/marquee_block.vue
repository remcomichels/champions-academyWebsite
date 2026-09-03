<template>
  <section :id="blok.anchor || undefined" v-editable="blok" class="section marquee" aria-label="Scrolling roles marquee">
    <!-- For claude scan, fix data-scroll-inview and data-letters in this file -->
    <div class="container-wide">
        <div class="text-group" data-scroll-inview>
            <p class="title">{{ blok.title }}</p>
        </div>
        <div class="marquee-group">
            <div
                ref="marqueeEl"
                class="marquee"
                data-marquee-direction="left"
                data-marquee-status="inverted"
                data-marquee-speed="20"
            >
                <div
                    ref="scrollEl"
                    class="marquee-scroll"
                    data-scroll
                    data-scroll-direction="horizontal"
                    data-scroll-speed="2"
                >
                    <div ref="trackA" class="marquee-content" aria-hidden="false">
                        <span v-for="(logo, index) in repeatedLogos" :key="`a-${logo.id}-${index}`" class="marquee-item">
                            <NuxtAppImage
                                :src="logo.filename || ''"
                                :alt="logo.alt || 'Logo'"
                                densities="x1"
                                loading="lazy"
                                class="word"
                            />
                            <span class="divider" />
                        </span>
                    </div>

                    <div ref="trackB" class="marquee-content" aria-hidden="true">
                        <span v-for="(logo, index) in repeatedLogos" :key="`b-${logo.id}-${index}`" class="marquee-item">
                            <NuxtAppImage
                                :src="logo.filename || ''"
                                :alt="logo.alt || 'Logo'"
                                densities="x1"
                                loading="lazy"
                                class="word"
                            />
                            <span class="divider" />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MarqueeBlockBlok } from "~/types/blocks";

import { computed, ref } from "vue";

const props = defineProps<{ blok: MarqueeBlockBlok }>();

const repeatedLogos = computed(() => [
	...(props.blok.item || []),
	...(props.blok.item || []),
]);


const marqueeEl = ref<HTMLElement | null>(null);
const scrollEl = ref<HTMLElement | null>(null);
const trackA = ref<HTMLElement | null>(null);
const trackB = ref<HTMLElement | null>(null);

useMarquee(marqueeEl, scrollEl, trackA, trackB);

const { initLetters, destroy } = useLetterAnimation()
onMounted(() => initLetters())
onUnmounted(() => destroy())
</script>
