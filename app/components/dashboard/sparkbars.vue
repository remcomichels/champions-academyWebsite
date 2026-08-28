<template>
	<!-- Decorative on purpose. The card states its peak in words directly above
	     — "Saturday", "118 visits" — and the same distribution is on the
	     Analytics heatmap, properly labelled, for anyone who wants all of it.
	     Announcing 24 more numbers here would repeat what has just been read in
	     a form nobody can hold in their head. The hover readout is a sighted
	     pointer affordance over information that is already reachable, which is
	     the one case where a tooltip is allowed not to have a focus twin. -->
	<span ref="plot" class="sparkbars" aria-hidden="true">
		<span
			v-for="(point, index) in bars"
			:key="index"
			class="sparkbars-slot"
			@pointerenter="show(index, $event)"
			@pointerleave="hover = null"
		>
			<span
				class="sparkbars-bar"
				:class="{ 'is-peak': index === peak }"
				:style="{ height: point.height }"
			/>

			<!-- Anchored to the slot rather than the bar: `bottom: 100%` against
			     a bar is the top of that bar, so the readout would ride up and
			     down as the pointer crossed the row. Against the slot it holds
			     one line above the plot whatever the bar underneath it does. -->
			<span
				v-if="hover === index"
				ref="tip"
				class="sparkbars-tip"
				:style="{ '--tip-shift': `${shift}px` }"
			>{{ point.label }} — {{ point.text }}</span>
		</span>
	</span>
</template>

<script setup lang="ts">
/**
 * The distribution a highlight figure came out of, at card scale.
 *
 * Scaled against the busiest slot rather than the total: these are 7 days or 24
 * hours of one affiliate's traffic, and against a sum every bar would be a
 * sliver. The peak takes the accent and everything else the de-emphasis hue, so
 * the bar the card names is the one that stands out.
 */
const props = withDefaults(defineProps<{
	points: { label: string; value: number }[];
	/** Index of the slot to accent — the one the card's headline names. */
	peak: number | null;
	unit?: string;
	unitOne?: string;
}>(), { unit: "visits", unitOne: "visit" });

/**
 * The hovered slot, and the correction that keeps its readout inside the plot.
 * Measured rather than derived from the index — see `clampChartTip`.
 */
const hover = ref<number | null>(null);
const shift = ref(0);
const plot = useTemplateRef<HTMLElement>("plot");
const tip = useTemplateRef<HTMLElement[]>("tip");

// A template ref inside `v-for` is collected as an array, even where `v-if`
// leaves exactly one of them rendered — so this reads the first entry rather
// than the ref itself. Handed the array, the measurement silently read
// `undefined` for a width and corrected by zero, which looked precisely like
// no clamping at all.
const tipEl = () => (Array.isArray(tip.value) ? tip.value[0] ?? null : tip.value);

const show = async (index: number, event: PointerEvent) => {
	const slot = event.currentTarget as HTMLElement;

	hover.value = index;
	shift.value = 0;
	await nextTick();
	shift.value = clampChartTip(tipEl(), slot, plot.value);
};

const bars = computed(() => {
	const max = Math.max(0, ...props.points.map(point => point.value));

	return props.points.map((point) => {
		return {
			label: point.label,
			text: `${point.value.toLocaleString("en-GB")} ${point.value === 1 ? props.unitOne : props.unit}`,

			// Floored, so an hour with a single visit is a visible mark rather
			// than a sub-pixel line indistinguishable from the empty slot beside
			// it. Only ever applied to a slot that genuinely has traffic — a
			// zero stays flat on the baseline, because "quiet" and "nothing" are
			// different readings and the floor must not blur them.
			height: max <= 0 || point.value <= 0
				? "0%"
				: `${Math.max((point.value / max) * 100, 8)}%`,
		};
	});
});
</script>
