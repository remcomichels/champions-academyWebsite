<template>
	<figure class="barChart">
		<figcaption v-if="caption" class="barChart-caption">{{ caption }}</figcaption>

		<div class="barChart-frame">
			<ul class="barChart-yAxis" aria-hidden="true">
				<li v-for="tick in ticks" :key="tick" class="barChart-tick">{{ format(tick) }}</li>
			</ul>

			<div class="barChart-plot">
				<div class="barChart-grid" aria-hidden="true">
					<span v-for="tick in ticks" :key="tick" class="barChart-gridLine" />
				</div>

				<!-- A table would be the honest markup for a chart, but this one is
				     a single series read at a glance. A list with a per-bar label
				     gives a screen reader the same figures in order without the
				     overhead of a grid the sighted view never renders. -->
				<ul class="barChart-cols">
					<li
						v-for="(point, i) in scaled"
						:key="point.label"
						class="barChart-col"
						:class="{ 'is-highlight': i === highlightIndex }"
					>
						<span class="barChart-track">
							<!-- The readout lives inside the bar rather than beside it.
							     Anchored to the column it sat at the top of the chart,
							     which for a short bar was a long way from the thing it
							     described; anchored to the bar, `bottom: 100%` is the
							     bar's own top edge whatever its height. -->
							<span class="barChart-fill" :style="{ height: `${point.pct}%` }">
								<span
									class="barChart-value"
									:class="point.edge"
									aria-hidden="true"
								>{{ point.caption }}</span>
							</span>
						</span>
						<span class="sr-only">{{ point.caption }}</span>
					</li>
				</ul>
			</div>

			<!-- Inside the frame grid, sharing its second column, so the labels
			     stay aligned with the bars whatever width the y-axis takes. -->
			<ul class="barChart-xAxis" aria-hidden="true">
				<li
					v-for="(point, i) in scaled"
					:key="point.label"
					class="barChart-xLabel"
				>{{ i % labelStep === 0 ? point.label : "" }}</li>
			</ul>
		</div>
	</figure>
</template>

<script setup lang="ts">
/**
 * A single-series bar chart, in CSS.
 *
 * No chart library: this is one series of small integers with no interaction
 * beyond a hover readout, and a charting dependency for that would cost more
 * in bundle size than the whole dashboard's JavaScript.
 *
 * Bars stay neutral (`--chart-bar`) and exactly one — the most recent period —
 * takes the accent, per the design system: if every bar is the accent colour,
 * it has stopped being an accent.
 */
const props = withDefaults(defineProps<{
	/**
	 * `label` goes under the axis and is kept short, because it has a column's
	 * width to fit in. `title` is what the hover readout says — give it the
	 * unabbreviated version, since a readout that says "3" over a bar in a row
	 * of ninety does not tell anybody which day it is.
	 */
	points: { label: string; value: number; title?: string }[];
	unit?: string;
	/** Singular of `unit`, so a lone bar does not read "1 sales". */
	unitOne?: string;
	caption?: string | null;
	/** Highlights the final bar, i.e. the current day or period. */
	highlightLast?: boolean;
}>(), {
	unit: "",
	unitOne: "",
	caption: null,
	highlightLast: true,
});

const rawMax = computed(() => Math.max(0, ...props.points.map(p => p.value)));

/**
 * Rounds the axis up to a 1/2/5 × 10ⁿ step so the gridlines land on readable
 * numbers instead of whatever the tallest bar happens to be. Floors at 4 so a
 * quiet week doesn't render three bars filling the full height, which reads as
 * a busy one until you check the axis.
 */
const axisMax = computed(() => {
	const max = rawMax.value;
	if (max <= 4) return 4;

	const magnitude = 10 ** Math.floor(Math.log10(max));
	const normalised = max / magnitude;
	const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

	return step * magnitude;
});

const ticks = computed(() => {
	const max = axisMax.value;
	return [max, max / 2, 0];
});

const scaled = computed(() => {
	const last = props.points.length - 1;

	return props.points.map((point, index) => {
		const unit = point.value === 1 && props.unitOne ? props.unitOne : props.unit;
		// Near either end the centred readout hangs past the side of the plot,
		// so it pins to that end of its bar and opens inwards. A fraction rather
		// than a fixed index, because this draws a fortnight and a quarter.
		const position = last > 0 ? index / last : 0.5;

		return {
			...point,
			// Floored at a hair above zero for any non-zero value, so "one visit"
			// is visible rather than rounding away to an empty column.
			pct: point.value === 0 ? 0 : Math.max((point.value / axisMax.value) * 100, 2),
			caption: `${point.title ?? point.label} — ${format(point.value)}${unit ? ` ${unit}` : ""}`,
			edge: position < 0.12 ? "is-start" : position > 0.88 ? "is-end" : undefined,
		};
	});
});

const highlightIndex = computed(() =>
	(props.highlightLast ? props.points.length - 1 : -1));

/**
 * Show about eight labels, whatever the point count.
 *
 * A label under every column stops being readable somewhere around twenty of
 * them: the slots are narrower than the text, so "10" renders as "1" and a
 * clipped bracket, which is worse than no label because it looks like a
 * different number. The blanked slots are kept in the DOM rather than removed,
 * so the remaining labels stay aligned with the columns they belong to.
 */
const labelStep = computed(() => Math.max(1, Math.ceil(props.points.length / 8)));

const format = (value: number) => value.toLocaleString("en-GB");
</script>
