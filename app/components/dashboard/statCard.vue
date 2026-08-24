<template>
	<div class="statCard" :class="{ 'is-accent': accent }">
		<div class="statCard-head">
			<p class="statCard-label">{{ label }}</p>
			<span v-if="icon" class="statCard-icon" aria-hidden="true">
				<NuxtDashboardIcon :name="icon" />
			</span>
		</div>

		<p class="statCard-value">{{ formatted }}</p>
		<p v-if="hint" class="statCard-hint">{{ hint }}</p>
	</div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
	label: string;
	value: number | string;
	hint?: string | null;
	icon?: string | null;
	/**
	 * Tints the figure with the accent. Reserved for the one number a screen
	 * exists to show — if two cards in a row set this, neither reads as special.
	 */
	accent?: boolean;
}>(), { hint: null, icon: null, accent: false });

// Grouped digits, because a four-figure visit count read as "1234" is the kind
// of thing people misread at a glance.
const formatted = computed(() =>
	typeof props.value === "number" ? props.value.toLocaleString("en-GB") : props.value,
);
</script>
