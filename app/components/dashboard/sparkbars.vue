<template>
	<!-- Decorative on purpose. The card states its peak in words directly above
	     — "Saturday", "118 visits" — and the same distribution is on the
	     Analytics heatmap, properly labelled, for anyone who wants all of it.
	     Announcing 24 more numbers here would repeat what has just been read in
	     a form nobody can hold in their head. The hover readout is a sighted
	     pointer affordance over information that is already reachable, which is
	     the one case where a tooltip is allowed not to have a focus twin. -->
	<span class="sparkbars" aria-hidden="true">
		<!-- `--i` and `--n` are the slot's index and the slot count. The readout
		     pins to the edge of the plot rather than of its own slot, and the
		     offset is the number of slots between this one and that edge — the
		     same arithmetic the bar chart's readout uses. -->
		<span
			v-for="(point, index) in bars"
			:key="index"
			class="sparkbars-slot"
			:style="{ '--i': index, '--n': bars.length }"
			@pointerenter="hover = index"
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
				class="sparkbars-tip"
				:class="point.edge"
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

const hover = ref<number | null>(null);

const bars = computed(() => {
	const max = Math.max(0, ...props.points.map(point => point.value));
	const last = props.points.length - 1;

	return props.points.map((point, index) => {
		// Near either end the centred readout would hang past the side of the
		// card, so it pins to that side instead — to the plot's edge, not the
		// slot's, which is what holds it still across the leading group rather
		// than stepping a slot at a time. Measured as a fraction rather than a
		// fixed index, because this plots both a 7-slot week and a 24-slot day.
		const position = last > 0 ? index / last : 0.5;

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

			edge: position < 0.2 ? "is-start" : position > 0.8 ? "is-end" : undefined,
		};
	});
});
</script>
