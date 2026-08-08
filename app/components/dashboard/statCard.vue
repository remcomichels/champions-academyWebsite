<template>
	<div class="statCard">
		<p class="statCard-label">{{ label }}</p>
		<p class="statCard-value">{{ formatted }}</p>
		<p v-if="hint" class="statCard-hint">{{ hint }}</p>
	</div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
	label: string;
	value: number | string;
	hint?: string | null;
}>(), { hint: null });

// Grouped digits, because a four-figure visit count read as "1234" is the kind
// of thing people misread at a glance.
const formatted = computed(() =>
	typeof props.value === "number" ? props.value.toLocaleString("en-GB") : props.value,
);
</script>
