<template>
	<div class="dashSection">
		<section class="dashPanel dashPanel--empty">
			<h2 class="dashPanel-title">{{ title }}</h2>
			<p class="dashPanel-note">{{ note }}</p>
		</section>
	</div>
</template>

<script setup lang="ts">
/**
 * Placeholder for a tab whose slice hasn't shipped yet.
 *
 * The tab exists so the shell is the real shape from the start, but it says
 * plainly that there is nothing here rather than showing empty charts and
 * zeroes — a dashboard reading "0 sales" is indistinguishable from a broken
 * one, and it's the kind of thing that generates support messages.
 */
defineProps<{ title: string; note: string }>();
</script>
