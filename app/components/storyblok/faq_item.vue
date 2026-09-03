<template>
	<div v-editable="blok" class="faq-item" :class="{ 'is-open': open }">
		<button
			type="button"
			class="faq-item-question"
			:aria-expanded="open"
			@click="open = !open"
		>
			<span class="faq-item-title">{{ question }}</span>
			<span class="faq-item-icon" aria-hidden="true" />
		</button>

		<div class="faq-item-answer">
			<div class="faq-item-answer-inner">
				<p class="faq-item-answer-text">{{ answer }}</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { FaqItemBlok } from "~/types/blocks";

const props = defineProps<{ blok: FaqItemBlok }>();

const open = ref(false);

// Storyblok content carries stray trailing newlines — trim so pre-line text
// doesn't render extra blank lines.
const question = computed(() => String(props.blok.question_title ?? "").trim());
const answer = computed(() => String(props.blok.answer_text ?? "").trim());
</script>
