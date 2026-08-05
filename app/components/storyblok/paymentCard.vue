<template>
	<article v-editable="blok" class="payment-card">
		<h3 class="payment-card-title">{{ blok.title }}</h3>

		<div class="payment-card-price">
			<span class="price">{{ blok.price }}</span>
			<span class="price-adjective">{{ blok.price_adjative }}</span>
		</div>

		<ul
			v-if="benefits.length"
			:id="listId"
			class="payment-card-benefits"
			:class="{ 'is-expanded': expanded }"
		>
			<li
				v-for="textBlok in blok.benefit"
				:key="textBlok._uid"
				class="payment-card-benefit"
				:class="{ 'is-extra': isExtra(textBlok._uid) }"
				:inert="isExtra(textBlok._uid) && !expanded"
			>
				<div class="payment-card-benefit-inner">
					<StoryblokComponent :blok="textBlok" />
				</div>
			</li>
		</ul>

		<button
			v-if="benefits.length > VISIBLE_BENEFITS"
			type="button"
			class="payment-card-more"
			:aria-expanded="expanded"
			:aria-controls="listId"
			@click="expanded = !expanded"
		>
			<span class="payment-card-more-label">{{ expanded ? "Show less" : "Show all" }}</span>
			<span class="payment-card-more-icon" aria-hidden="true" />
		</button>

		<div v-if="blok.Bonus_benefit" class="payment-card-bonus-container">
			<span class="icon-candles"/>
			<p class="payment-card-bonus">{{ blok.Bonus_benefit }}</p>
		</div>

		<div class="payment-card-footer">
			<!-- eslint-disable-next-line vue/no-v-html -- sanitised by renderSafeRichText -->
			<div v-if="subTextHtml" class="payment-card-subText" v-html="subTextHtml" />
			<StoryblokComponent
				v-for="buttonBlok in blok.button"
				:key="buttonBlok._uid"
				:blok="buttonBlok"
			/>
		</div>
	</article>
</template>

<script setup lang="ts">
import type { TextBlok } from "~/types/storyblok";

const props = defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

// How many benefits show before the list is truncated. Plans run to a dozen
// entries, which pushed the price and CTA of the second card off the screen.
const VISIBLE_BENEFITS = 5;

// Typed for the count and the truncation logic. The loop renders from
// `blok.benefit` directly, because <StoryblokComponent>'s `blok` prop is the
// broad SbBlokData and TextBlok isn't assignable to it.
const benefits = computed<TextBlok[]>(() => props.blok.benefit ?? []);

// Per-card, not per-block: the two plans have different benefit counts, so one
// can be truncated while the other shows in full.
const expanded = ref(false);

// Which rows collapse. Keyed by _uid rather than the v-for index, since the
// loop runs over the untyped `blok.benefit` and its index widens to
// `string | number`.
const extraUids = computed(
	() => new Set(benefits.value.slice(VISIBLE_BENEFITS).map((textBlok) => textBlok._uid)),
);

function isExtra(uid: string): boolean {
	return extraUids.value.has(uid);
}

// Ties the button to the list it controls. _uid is unique per card, so the two
// cards' lists never collide.
const listId = computed(() => `benefits-${props.blok._uid}`);

// renderSafeRichText escapes text nodes, strips javascript: hrefs, and returns
// "" for an empty document, so the v-if collapses the footer caption when unset.
const subTextHtml = computed(() => renderSafeRichText(props.blok.subText_button_rich));
</script>
