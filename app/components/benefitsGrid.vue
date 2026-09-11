<template>
	<div
		ref="grid"
		class="benefits-grid"
		@pointermove="onPointerMove"
		@pointerleave="onPointerLeave"
	>
		<article v-for="{ story, media } in cards" :key="story.uuid" class="benefit-card">
			<div class="benefit-media" aria-hidden="true">
				<NuxtAppImage
					v-if="media"
					class="benefit-image benefit-image--dim"
					:src="media.src"
					:alt="media.alt"
					:sizes="sizes"
				/>
				<!-- Liquid trail — masked shape, merged into metaballs by the goo filter -->
				<div class="benefit-blob">
					<span class="benefit-blob-shape" />
				</div>
			</div>
			<div class="benefit-body">
				<component :is="headingTag" class="benefit-title">{{ story.name }}</component>
				<p v-if="story.content?.text" class="benefit-text">{{ story.content.text }}</p>
			</div>
		</article>

		<!-- Gooey filter: blur + alpha threshold merges the trail circles
		     into one flowing liquid mass. Referenced by .benefit-blob. -->
		<svg class="benefit-goo-defs" width="0" height="0" aria-hidden="true" focusable="false">
			<defs>
				<filter id="benefitGoo" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
					<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
					<feColorMatrix
						in="blur"
						type="matrix"
						values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
					/>
				</filter>
			</defs>
		</svg>
	</div>
</template>

<script setup lang="ts">
// The square benefit-card grid with the liquid reveal blob. Shared by
// benefits_block (a hand-picked selection, blob drifts on its own) and
// benefitsOverview_block (every benefit, blob follows the pointer only).
import type { BenefitStoryRef } from "~/types/storyblok";

const props = defineProps({
	/** Benefit stories — resolved relations or fetched from the benefits folder. */
	items: {
		type: Array as PropType<BenefitStoryRef[]>,
		default: () => [],
	},
	/** Let the blob drift by itself when the pointer is elsewhere. */
	autoWander: {
		type: Boolean,
		default: true,
	},
	/** Responsive sizes hint for the card images. */
	sizes: {
		type: String,
		default: "sm:100vw md:50vw lg:34vw",
	},
	/**
	 * Heading level for a card title, so the grid nests correctly wherever it
	 * lands. On home it sits under the block's h2 and its h3 sub-title, so the
	 * default is right; on /benefits the block title is the page h1 and the
	 * cards are the level below it. Styling is on .benefit-title either way,
	 * so this changes nothing visually.
	 */
	headingLevel: {
		type: Number as PropType<2 | 3 | 4>,
		default: 4,
	},
});

const headingTag = computed(() => `h${props.headingLevel}`);

interface CardMedia { src: string; alt: string }

// The benefit story's `image` asset. object-fit: cover in the LESS keeps any
// source square inside the 1:1 card.
function mediaOf(story: BenefitStoryRef): CardMedia | null {
	const img = story.content?.image as { filename?: string; alt?: string } | undefined;
	if (!img?.filename) return null;
	return { src: img.filename, alt: img.alt || story.name || "" };
}

const cards = computed(() => props.items.map((story) => ({ story, media: mediaOf(story) })));

const grid = useTemplateRef<HTMLElement>("grid");
const { initBlob, destroy, onPointerMove, onPointerLeave } = useLiquidBlob(grid, {
	autoWander: props.autoWander,
});

onMounted(() => initBlob());
onUnmounted(() => destroy());
</script>
