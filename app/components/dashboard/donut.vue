<template>
	<div class="donut" :class="{ 'is-empty': !slices.length }">
		<template v-if="slices.length">
			<div class="donut-ring">
				<svg class="donut-svg" viewBox="0 0 100 100" role="presentation">
					<!-- Rotated so the first and largest slice starts at twelve
					     o'clock, which is where the eye starts reading a ring. -->
					<g transform="rotate(-90 50 50)">
						<circle
							v-for="slice in slices"
							:key="slice.label"
							class="donut-arc"
							:class="{ 'is-dim': active !== null && active !== slice.index }"
							cx="50"
							cy="50"
							:r="RADIUS"
							:stroke="slice.color"
							:stroke-width="THICKNESS"
							:stroke-dasharray="`${slice.length} ${CIRCUMFERENCE - slice.length}`"
							:stroke-dashoffset="-slice.offset"
							@pointerenter="active = slice.index"
							@pointerleave="active = null"
						/>
					</g>
				</svg>

				<!-- The readout. A ring's slices are thin arcs and a floating
				     tooltip over a circle has no good side to open on, so the
				     hole does the job the tooltip would: it already holds the
				     total, and on hover it holds the slice instead. -->
				<div class="donut-centre" aria-hidden="true">
					<p class="donut-centreValue">{{ centre.value }}</p>
					<p class="donut-centreLabel">{{ centre.label }}</p>
				</div>
			</div>

			<!-- Always shipped, never optional. Two of the five slot colours sit
			     under 3:1 against the light surface, which the palette permits
			     only where visible labels carry the identity instead — these
			     rows are those labels. They also hold the exact figures a ring
			     cannot: neighbouring slices of a similar size are the one thing
			     a donut genuinely cannot be read for. -->
			<ul class="donut-legend">
				<li
					v-for="slice in slices"
					:key="slice.label"
					class="donut-legendRow"
					:class="{ 'is-dim': active !== null && active !== slice.index }"
					@pointerenter="active = slice.index"
					@pointerleave="active = null"
				>
					<span class="donut-key" :style="{ backgroundColor: slice.color }" aria-hidden="true" />
					<span class="donut-name" :title="slice.label">{{ slice.label }}</span>
					<span class="donut-count">{{ slice.visits.toLocaleString("en-GB") }}</span>

					<span
						v-if="slice.trend"
						class="donut-trend"
						:class="`is-${slice.trend.direction}`"
					>
						<NuxtDashboardIcon :name="`trend${capitalise(slice.trend.direction)}`" />
						<span class="sr-only">{{ slice.trend.text }}</span>
						<span aria-hidden="true">{{ slice.trend.short }}</span>
					</span>
					<span v-else class="donut-trend is-none" aria-hidden="true" />
				</li>
			</ul>
		</template>

		<p v-else class="dashPanel-empty">{{ empty }}</p>
	</div>
</template>

<script setup lang="ts">
/**
 * Where traffic came from, as a part-to-whole ring with its own ranked legend.
 *
 * A donut is only honest at a glance and only for a handful of segments, so the
 * tail is folded into one "Other" rather than drawn as slivers, and the legend
 * beside it carries the exact numbers. Anything that needs comparing precisely
 * is read there, not off the ring.
 */
const props = withDefaults(defineProps<{
	items: { label: string; visits: number; previousVisits: number }[];
	/** Names the comparison window in each row's trend, e.g. "vs previous 30 days". */
	periodLabel: string;
	empty: string;
	/** Named slices before the rest folds into "Other". */
	max?: number;
}>(), { max: 5 });

const RADIUS = 42;
const THICKNESS = 13;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// The house surface gap, in viewBox units. Slices separate because of the space
// between them rather than a stroke around them — a ring drawn with borders
// gains a lot of ink that is not data.
const GAP = 1.6;

const active = ref<number | null>(null);

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * The ranked sources, with everything past `max` folded into one share.
 *
 * The fold is flagged rather than inferred from the index. Inferring it — "the
 * last slice, when there are more than `max` of them" — is wrong at exactly
 * `max + 1` sources, where nothing has been folded and the last slice is a real
 * source: it would be painted the neutral and made to share slot 5's hue with
 * its neighbour, which is the one thing a categorical palette may never do.
 */
const folded = computed(() => {
	const ranked = [...props.items]
		.sort((a, b) => b.visits - a.visits)
		.filter(item => item.visits > 0)
		.map(item => ({ ...item, isOther: false }));

	if (ranked.length <= props.max) return ranked;

	const rest = ranked.slice(props.max);

	return [
		...ranked.slice(0, props.max),
		{
			// Named for what it is rather than "Other (7)": the count is
			// already in the row's own figure, and the parenthetical reads
			// as a rank. A fold of exactly one keeps that source's own name
			// — "1 other" would drop a hostname to say nothing, and the
			// neutral swatch already carries the only claim being made,
			// which is that it fell outside the top five.
			label: rest.length === 1 ? (rest[0]?.label ?? "1 other") : `${rest.length} others`,
			visits: rest.reduce((sum, item) => sum + item.visits, 0),
			previousVisits: rest.reduce((sum, item) => sum + item.previousVisits, 0),
			isOther: true,
		},
	];
});

const total = computed(() => folded.value.reduce((sum, item) => sum + item.visits, 0));

const slices = computed(() => {
	const sum = total.value;
	if (sum <= 0) return [];

	let offset = 0;

	return folded.value.map((item, index) => {
		const full = (item.visits / sum) * CIRCUMFERENCE;

		// Every slice gives up the gap at its trailing edge, so the ring stays
		// closed and the arcs stay proportional to each other. Floored, or a
		// source with a single visit becomes a negative arc and vanishes —
		// worse than a slightly generous sliver, because the legend row beside
		// it would then key off a colour with nothing on the ring wearing it.
		const length = Math.max(full - GAP, 1.2);
		const start = offset;

		offset += full;

		return {
			index,
			label: item.label,
			visits: item.visits,
			offset: start,
			length,
			// Fixed order, assigned by rank and never cycled. Named slices only
			// ever occupy indices 0…max-1, and the fold takes the neutral, so
			// the ring cannot repeat a hue however many sources there are.
			color: item.isOther ? "var(--series-other)" : `var(--series-${index + 1})`,
			trend: shortTrend(item.visits, item.previousVisits),
		};
	});
});

/**
 * A row's own change, with a compact label the legend has room for.
 *
 * Reuses the shared helper so the awkward cases stay consistent with every
 * other trend on the dashboard — nothing at all from zero to zero, "up from
 * zero" rather than an infinite percentage — and keeps its full wording for
 * screen readers while the row shows just the number.
 */
function shortTrend(current: number, previous: number) {
	const result = trend(current, previous, props.periodLabel);
	if (!result) return null;

	return {
		...result,
		short: previous === 0
			? "new"
			: `${Math.abs(Math.round(((current - previous) / previous) * 100))}%`,
	};
}

const centre = computed(() => {
	const slice = active.value === null ? null : slices.value[active.value];

	if (!slice) {
		return {
			value: total.value.toLocaleString("en-GB"),
			label: total.value === 1 ? "visit" : "visits",
		};
	}

	return {
		value: `${Math.round((slice.visits / total.value) * 100)}%`,
		label: slice.label,
	};
});
</script>
