<template>
	<section v-editable="blok" data-scroll-inview class="section benefits_block">
		<div class="container benefits-container">
			<div class="text-container">
				<p class="subText">{{ blok.sub_text }}</p>
				<div class="title-container">
					<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
					<h3 class="subTitle">{{ blok.sub_title }}</h3>
				</div>
				<p class="text">{{ blok.text }}</p>
				<div v-if="blok.button?.length" class="button-container">
					<StoryblokComponent
						v-for="buttonBlok in blok.button"
						:key="buttonBlok._uid"
						:blok="buttonBlok"
					/>
				</div>
			</div>

			<div v-if="benefits.length" class="benefits-grid" @pointermove="onCardPointerMove">
				<article v-for="story in benefits" :key="story.uuid" class="benefit-card">
					<h4 class="benefit-title">{{ story.name }}</h4>
					<p v-if="story.content?.text" class="benefit-text">{{ story.content.text }}</p>
				</article>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { BenefitStoryRef } from '~/types/storyblok'

const props = defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

// The `benefit` multi-options field stores story UUIDs; resolve_relations in
// [...slug].vue swaps them for full story objects. Skip any that stayed
// unresolved (raw UUID strings).
const benefits = computed<BenefitStoryRef[]>(() =>
	(props.blok.benefit ?? []).filter(
		(entry: unknown): entry is BenefitStoryRef => typeof entry === "object" && entry !== null,
	),
);

// Flashlight-grid hover (desktop only — below 1081px / touch the cards show a
// static corner glow instead, see the LESS). The glow trails the pointer:
// moves only set a target, and a RAF loop eases the visible position toward
// it, written into every card relative to its own box so the light spills
// across the gaps. The `has-pointer` class keeps the overlays hidden until a
// real pointer position exists — otherwise scrolling the grid under a
// stationary cursor would flash every card's glow at its default center.
const { reduced } = useReducedMotion();

let desktopFlashlight: MediaQueryList | null = null;
let gridEl: HTMLElement | null = null;
let flashRaf: number | null = null;
let hasPointer = false;
const pointerNow = { x: 0, y: 0 };
const pointerTarget = { x: 0, y: 0 };

function renderFlashlight(): void {
	flashRaf = null;
	if (!gridEl) return;

	const ease = reduced.value ? 1 : 0.12;
	pointerNow.x += (pointerTarget.x - pointerNow.x) * ease;
	pointerNow.y += (pointerTarget.y - pointerNow.y) * ease;

	gridEl.querySelectorAll<HTMLElement>(".benefit-card").forEach((card) => {
		const rect = card.getBoundingClientRect();
		card.style.setProperty("--mx", `${pointerNow.x - rect.left}px`);
		card.style.setProperty("--my", `${pointerNow.y - rect.top}px`);
	});

	// Keep easing until the trail has caught up with the pointer
	if (Math.hypot(pointerTarget.x - pointerNow.x, pointerTarget.y - pointerNow.y) > 0.5) {
		flashRaf = requestAnimationFrame(renderFlashlight);
	}
}

function onCardPointerMove(event: PointerEvent): void {
	desktopFlashlight ??= window.matchMedia("(hover: hover) and (min-width: 1081px)");
	if (!desktopFlashlight.matches) return;

	gridEl = event.currentTarget as HTMLElement;
	pointerTarget.x = event.clientX;
	pointerTarget.y = event.clientY;

	if (!hasPointer) {
		// First contact: start at the cursor instead of trailing in from (0,0)
		hasPointer = true;
		pointerNow.x = pointerTarget.x;
		pointerNow.y = pointerTarget.y;
		gridEl.classList.add("has-pointer");
	}

	if (flashRaf === null) flashRaf = requestAnimationFrame(renderFlashlight);
}

const { initLetters, destroy } = useLetterAnimation();

onMounted(() => initLetters());

onUnmounted(() => {
	destroy();
	if (flashRaf !== null) cancelAnimationFrame(flashRaf);
});
</script>
