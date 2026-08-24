<template>
	<figure class="heatmap">
		<div class="heatmap-grid">
			<span class="heatmap-corner" aria-hidden="true" />

			<span
				v-for="tick in hourTicks"
				:key="`t${tick.hour}`"
				class="heatmap-hourLabel"
				:style="{ gridColumn: `${tick.hour + 2} / span 3` }"
				aria-hidden="true"
			>{{ tick.label }}</span>

			<template v-for="row in rows" :key="row.dow">
				<span class="heatmap-dayLabel" aria-hidden="true">{{ row.label }}</span>
				<span
					v-for="cell in row.cells"
					:key="`${row.dow}-${cell.hour}`"
					class="heatmap-cell"
					:class="{ 'is-empty': cell.visits === 0 }"
					:style="cell.visits ? { opacity: cell.intensity } : undefined"
					:title="`${row.full} ${pad(cell.hour)}:00 — ${cell.visits} ${cell.visits === 1 ? 'visit' : 'visits'}`"
				/>
			</template>
		</div>

		<figcaption class="heatmap-foot">
			<span v-if="peak" class="heatmap-peak">
				Busiest: <strong>{{ peak.day }} around {{ pad(peak.hour) }}:00</strong>
			</span>
			<span v-else class="heatmap-peak">No visits in this period yet.</span>

			<span class="heatmap-legend" aria-hidden="true">
				fewer
				<span class="heatmap-legendCell is-empty" />
				<span v-for="step in 4" :key="step" class="heatmap-legendCell" :style="{ opacity: step / 4 }" />
				more
			</span>
		</figcaption>

		<!-- The grid is decorative markup; this is the same information in a form
		     a screen reader can read out without navigating 168 cells. -->
		<p class="sr-only">
			{{ peak
				? `Busiest period: ${peak.day} around ${pad(peak.hour)}:00, ${peak.visits} visits. Times shown in ${timezone}.`
				: "No visits recorded in this period." }}
		</p>
	</figure>
</template>

<script setup lang="ts">
/**
 * When an affiliate's link gets opened, as a day-by-hour grid.
 *
 * Built from `referral_visits.occurred_at`, already recorded server-side — so
 * unlike anything measured in the browser, no ad blocker can thin it out.
 * The hours arrive already converted into the affiliate's own timezone by the
 * API: "when should I post" is meaningless in UTC.
 */
const props = defineProps<{
	cells: { dow: number; hour: number; visits: number }[];
	timezone: string;
}>();

const DAYS = [
	{ dow: 1, label: "Mon", full: "Monday" },
	{ dow: 2, label: "Tue", full: "Tuesday" },
	{ dow: 3, label: "Wed", full: "Wednesday" },
	{ dow: 4, label: "Thu", full: "Thursday" },
	{ dow: 5, label: "Fri", full: "Friday" },
	{ dow: 6, label: "Sat", full: "Saturday" },
	{ dow: 7, label: "Sun", full: "Sunday" },
];

const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21].map(hour => ({
	hour,
	label: `${String(hour).padStart(2, "0")}`,
}));

const pad = (hour: number) => String(hour).padStart(2, "0");

const lookup = computed(() => {
	const map = new Map<string, number>();
	for (const cell of props.cells) map.set(`${cell.dow}-${cell.hour}`, cell.visits);
	return map;
});

const busiest = computed(() =>
	props.cells.reduce((max, cell) => (cell.visits > max ? cell.visits : max), 0));

const LEVELS = 4;

/** 0 for an empty hour, otherwise 1–4 — any traffic at all is always visible. */
const level = (visits: number) => {
	if (visits <= 0 || busiest.value <= 0) return 0;
	return Math.min(LEVELS, Math.max(1, Math.ceil((visits / busiest.value) * LEVELS)));
};

const rows = computed(() => DAYS.map(day => ({
	...day,
	cells: Array.from({ length: 24 }, (_, hour) => {
		const visits = lookup.value.get(`${day.dow}-${hour}`) ?? 0;
		return {
			hour,
			visits,
			// Quantised into four steps rather than a continuous ramp, for two
			// reasons: it matches the four swatches in the legend, and one busy
			// hour no longer washes every other cell out to near-invisible the
			// way a linear scale against the maximum does.
			intensity: level(visits) / LEVELS,
		};
	}),
})));

const peak = computed(() => {
	if (!props.cells.length || !busiest.value) return null;

	const top = props.cells.reduce((best, cell) => (cell.visits > best.visits ? cell : best));
	const day = DAYS.find(d => d.dow === top.dow);

	return day ? { day: day.full, hour: top.hour, visits: top.visits } : null;
});
</script>
