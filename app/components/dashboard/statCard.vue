<template>
	<div class="statCard" :class="{ 'is-accent': accent, 'is-loading': loading }" :aria-busy="loading || undefined">
		<!-- Rendered even with no icon to pass, so the tile still holds its
		     column and the labels beside it stay in line across a row. With the
		     card's border gone, that alignment is the only thing left grouping
		     one reading with the next. -->
		<span class="statCard-icon" :class="{ 'is-empty': !icon }" aria-hidden="true">
			<NuxtDashboardIcon v-if="icon" :name="icon" />
		</span>

		<div class="statCard-body">
			<p class="statCard-label">{{ label }}</p>

			<p class="statCard-value">{{ formatted }}</p>

			<p v-if="trend" class="statCard-trend" :class="`is-${trend.direction}`">
				<NuxtDashboardIcon :name="`trend${capitalise(trend.direction)}`" />
				{{ trend.text }}
			</p>

			<p v-if="hint" class="statCard-hint">{{ hint }}</p>

			<!-- The stale figure above is still in the DOM while loading — that
			     is what holds the card's height steady — so it is announced as
			     busy rather than read out as current. Absolutely positioned, so
			     it adds no flex gap. -->
			<span v-if="loading" class="sr-only">Updating {{ label }}…</span>
		</div>
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
	/**
	 * Paints a placeholder over the figure and its trend while a new one is
	 * fetched. The label, icon and hint keep rendering: they are known before
	 * the request lands, and a card that only greys out the parts that change
	 * cannot shift the grid underneath it.
	 */
	loading?: boolean;
}>(), { hint: null, icon: null, trend: null, accent: false, loading: false });

// Grouped digits, because a four-figure visit count read as "1234" is the kind
// of thing people misread at a glance.
const formatted = computed(() =>
	typeof props.value === "number" ? props.value.toLocaleString("en-GB") : props.value,
);

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
</script>
