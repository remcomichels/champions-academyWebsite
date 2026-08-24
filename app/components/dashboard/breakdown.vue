<template>
	<ul v-if="rows.length" class="breakdown">
		<li v-for="row in rows" :key="row.key" class="breakdown-row">
			<span class="breakdown-name" :title="row.label">{{ row.label }}</span>
			<span class="breakdown-bar" aria-hidden="true">
				<span class="breakdown-fill" :style="{ transform: `scaleX(${row.share})` }" />
			</span>
			<span class="breakdown-count">{{ row.visits.toLocaleString("en-GB") }}</span>
		</li>
	</ul>

	<p v-else class="dashPanel-empty">{{ empty }}</p>
</template>

<script setup lang="ts">
/**
 * A ranked list with a proportional bar — the shape every traffic breakdown on
 * this page uses. Bars are scaled against the busiest row rather than the
 * total, so a long tail is still readable instead of collapsing into slivers.
 */
const props = defineProps<{
	items: { label: string; visits: number }[];
	empty: string;
}>();

const rows = computed(() => {
	const top = props.items[0]?.visits ?? 0;

	return props.items.map((item, index) => ({
		key: `${index}-${item.label}`,
		label: item.label,
		visits: item.visits,
		// Floored so a row with one visit still shows a sliver of bar.
		share: top > 0 ? Math.max(item.visits / top, 0.03) : 0,
	}));
});
</script>
