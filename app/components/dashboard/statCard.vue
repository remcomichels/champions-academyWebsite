<template>
	<div class="statCard" :class="{ 'is-accent': accent }">
		<div class="statCard-head">
			<p class="statCard-label">{{ label }}</p>
			<span v-if="icon" class="statCard-icon" aria-hidden="true">
				<NuxtDashboardIcon :name="icon" />
			</span>
		</div>

		<p class="statCard-value">{{ formatted }}</p>

		<p v-if="trend" class="statCard-trend" :class="`is-${trend.direction}`">
			<NuxtDashboardIcon :name="`trend${capitalise(trend.direction)}`" />
			{{ trend.text }}
		</p>

		<p v-if="hint" class="statCard-hint">{{ hint }}</p>
	</div>
</template>

<script setup lang="ts">
import type { Trend } from "#shared/utils/trend";

const props = withDefaults(defineProps<{
	label: string;
	value: number | string;
	hint?: string | null;
	icon?: string | null;
	/**
	 * Period-over-period change. Null hides the row entirely rather than
	 * showing a zero — see the note in shared/utils/trend.ts about the cases
	 * where a percentage would be dishonest.
	 */
	trend?: Trend | null;
	/**
	 * Tints the figure with the accent. Reserved for the one number a screen
	 * exists to show — if two cards in a row set this, neither reads as special.
	 */
	accent?: boolean;
}>(), { hint: null, icon: null, trend: null, accent: false });

// Grouped digits, because a four-figure visit count read as "1234" is the kind
// of thing people misread at a glance.
const formatted = computed(() =>
	typeof props.value === "number" ? props.value.toLocaleString("en-GB") : props.value,
);

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
</script>
