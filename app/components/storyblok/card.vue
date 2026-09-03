<template>
	<article v-editable="blok" class="about-card">
		<span class="about-card-number" aria-hidden="true" />
		<h3 class="about-card-title">{{ blok.title }}</h3>
		<p class="about-card-text">{{ blok.text }}</p>
	</article>
</template>

<script setup lang="ts">
import type { CardBlok } from "~/types/blocks";

defineProps<{ blok: CardBlok }>();
</script>
