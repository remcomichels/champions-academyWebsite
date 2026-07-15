<template>
	<div v-editable="blok" data-scroll-inview class="step">
		<span class="step-number">{{ blok.number }}</span>
		<div class="step-content">
			<h3 class="step-title">{{ blok.title }}</h3>
			<p class="step-text">{{ blok.text }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps({
	blok: {
		type: Object,
		required: true,
	},
});
</script>
