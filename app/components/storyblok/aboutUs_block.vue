<template>
	<section :id="blok.anchor || undefined" ref="root" v-editable="blok" data-scroll-inview class="section aboutUs_block">
		<div class="container aboutUs-container">
			<div class="text-container">
				<p class="subTitle">{{ blok.sub_title }}</p>
				<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
				<p class="text">{{ blok.text }}</p>

				<div v-if="cards.length" class="indicator" aria-hidden="true">
					<span class="indicator-count">
						<Transition name="indicator-roll">
							<span :key="activeIndex" class="indicator-current">{{ formatIndex(activeIndex + 1) }}</span>
						</Transition>
					</span>
					<div class="indicator-lines">
						<span v-for="cardBlok in cards" :key="cardBlok._uid" class="indicator-line">
							<span class="indicator-line-fill" data-deck-line-fill />
						</span>
					</div>
					<span class="indicator-total">{{ formatIndex(cards.length) }}</span>
				</div>
			</div>

			<div v-if="cards.length" class="cards-container" data-deck-cards>
				<StoryblokComponent
					v-for="cardBlok in cards"
					:key="cardBlok._uid"
					:blok="cardBlok"
					data-deck-card
				/>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
const props = defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

const cards = computed(() => props.blok.cards ?? []);

function formatIndex(value: number): string {
	return String(value).padStart(2, "0");
}

const root = useTemplateRef<HTMLElement>("root");
const { initDeck, destroy: destroyDeck, activeIndex } = useCardDeck(root);
const { initLetters, destroy: destroyLetters } = useLetterAnimation();

onMounted(() => {
	initDeck();
	initLetters();
});

onUnmounted(() => {
	destroyDeck();
	destroyLetters();
});
</script>
