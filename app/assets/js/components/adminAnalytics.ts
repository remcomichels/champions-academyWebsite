import { computed, ref, watch } from "vue";
import { useRequestHeaders } from "#imports";
import type { Trend } from "#shared/utils/trend";

/**
 * Programme-wide analytics.
 *
 * The affiliate pages ask "how am I doing". This asks "how is the programme
 * doing, and who is carrying it", which is the same three tables read across
 * everybody instead of filtered to one.
 */

export interface LeaderRow {
	id: string;
	slug: string;
	displayName: string;
	status: string;
	visits: number;
	clicks: number;
	sales: number;
}

export interface ProgramAnalyticsResponse {
	days: number;
	totals: {
		visits: number; clicks: number; sales: number; countries: number;
		affiliatesTotal: number; affiliatesActive: number; affiliatesSelling: number;
	};
	trends: { visits: Trend | null; clicks: Trend | null; sales: Trend | null; active: Trend | null };
	byDay: { day: string; visits: number; clicks: number; sales: number }[];
	sources: { label: string; visits: number; previousVisits: number }[];
	countries: { country: string; visits: number }[];
	clicksByRole: { role: string; clicks: number }[];
	leaderboard: LeaderRow[];
	funnel: { label: string; value: number }[];
}

export const RANGES = [
	{ id: 7, label: "7 days" },
	{ id: 30, label: "30 days" },
	{ id: 90, label: "90 days" },
] as const;

const number = (value: number) => value.toLocaleString("en-GB");

export function useAdminAnalytics() {
	const days = ref<number>(30);
	const data = ref<ProgramAnalyticsResponse | null>(null);
	const pending = ref(false);
	const failed = ref(false);

	async function load() {
		pending.value = true;
		failed.value = false;

		try {
			data.value = await $fetch<ProgramAnalyticsResponse>("/api/admin/analytics", {
				query: { days: days.value },
				headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
			});
		}
		catch {
			failed.value = true;
		}
		finally {
			pending.value = false;
		}
	}

	// The previous figures stay on screen while the new range loads — the cards
	// dim rather than emptying, so the grid never collapses and reflows.
	watch(days, load);

	/**
	 * Daily visits.
	 *
	 * One series, so no legend: the panel title names it. `title` carries the
	 * full date for the hover readout while `label` stays short enough for a
	 * column, which is what barChart's two fields are for.
	 */
	const series = computed(() =>
		(data.value?.byDay ?? []).map((row) => {
			const date = new Date(`${row.day}T00:00:00Z`);
			return {
				label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
				title: date.toLocaleDateString("en-GB", {
					weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
				}),
				value: row.visits,
			};
		}));

	/** Sales per day, plotted separately rather than as a second axis on the
	 *  visits chart — two measures three orders of magnitude apart share no
	 *  scale, and a dual axis is the one thing a chart may never do. */
	const salesSeries = computed(() =>
		(data.value?.byDay ?? []).map((row) => {
			const date = new Date(`${row.day}T00:00:00Z`);
			return {
				label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
				title: date.toLocaleDateString("en-GB", {
					weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
				}),
				value: row.sales,
			};
		}));

	const funnelSteps = computed(() => {
		const steps = data.value?.funnel ?? [];
		const top = steps[0]?.value ?? 0;

		// Floored so a real figure is always a bar rather than a dot against the
		// track. At programme ratios an honest width is often under a pixel, and
		// a mark too small to read as a mark reads as a rendering fault — the
		// number beside it is the exact one.
		return steps.map((step, index) => ({
			label: step.label,
			value: number(step.value),
			share: top > 0 && step.value > 0 ? Math.max(step.value / top, 0.02) : 0,
			lead: index === steps.length - 1,
		}));
	});

	/**
	 * The leaderboard, with a bar per row.
	 *
	 * Length encodes the ranking; every row is the same hue on purpose. A colour
	 * per affiliate would tie identity to rank, so changing the range would
	 * repaint everyone — and rank is not an identity worth colouring.
	 */
	const leaders = computed(() => {
		const rows = data.value?.leaderboard ?? [];
		const top = Math.max(0, ...rows.map(row => row.sales));

		return rows.map((row, index) => ({
			...row,
			rank: index + 1,
			// Against visits when nobody has sold yet, so the panel still ranks
			// something rather than showing ten empty tracks.
			share: top > 0
				? (row.sales > 0 ? Math.max(row.sales / top, 0.03) : 0)
				: 0,
			visitsLabel: number(row.visits),
			clicksLabel: number(row.clicks),
			salesLabel: number(row.sales),
		}));
	});

	const countries = computed(() =>
		(data.value?.countries ?? []).map(row => ({ label: row.country, visits: row.visits })));

	const periodLabel = computed(() => `vs previous ${days.value} days`);

	/** "of N active" under the tile, so the figure has something to mean. */
	const activeHint = computed(() => {
		const totals = data.value?.totals;
		if (!totals) return null;
		return `of ${number(totals.affiliatesTotal)} active · ${number(totals.affiliatesSelling)} selling`;
	});

	return {
		days, data, pending, failed, load,
		series, salesSeries, funnelSteps, leaders, countries,
		periodLabel, activeHint,
	};
}
