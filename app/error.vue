<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import type { NuxtError } from "#app";
import { errorTemplates, handleCtaClick } from "~/assets/js/components/error";

const { error } = defineProps<{
	error: NuxtError;
}>();

// Get the appropriate error template based on status code
const errorTemplate = computed(() => {
	return errorTemplates[error.status as keyof typeof errorTemplates] || errorTemplates.default;
});

// Set the page title dynamically
useHead({
	title: () => errorTemplate.value.title,
});
</script>

<template>
	<div class="error-page">
		<div class="error-content">
			<h1 class="error-title">
				{{ errorTemplate.title }}
			</h1>
			<p class="error-message">
				{{ errorTemplate.message }}
			</p>
			<button
				class="error-cta"
				@click="handleCtaClick(errorTemplate.cta.link)"
			>
				{{ errorTemplate.cta.text }}
			</button>
		</div>
	</div>
</template>

<style scoped>
	@import "~/assets/less/components/error.less";
</style>
