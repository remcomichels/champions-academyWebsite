<template>
	<div class="dashSection">
		<!-- Bare on the page, not inside a panel, matching Analytics: the tabs
		     govern everything below them, so boxing them in with the figures
		     would understate what they control. -->
		<header class="dashHead">
			<h2 class="dashHead-title">Your sales</h2>
			<div class="rangeTabs">
				<button
					v-for="option in ranges"
					:key="option.id"
					type="button"
					class="rangeTabs-tab"
					:class="{ 'is-active': range === option.id }"
					@click="range = option.id"
				>
					{{ option.label }}
				</button>
			</div>
		</header>

		<NuxtAlertBanner v-if="error" variant="error">
			Couldn't load your sales just now. Try again in a minute.
		</NuxtAlertBanner>

		<template v-else>
			<div class="statGrid">
				<NuxtDashboardStatCard
					label="Sales"
					:value="data?.counts.window ?? 0"
					icon="tag"
					accent
					:trend="salesTrend"
					:loading="pending"
				/>
				<NuxtDashboardStatCard
					label="Link visits"
					:value="data?.funnel.visits ?? 0"
					icon="home"
					:trend="visitsTrend"
					hint="Counted on our own server"
					:loading="pending"
				/>
				<NuxtDashboardStatCard
					label="Conversion"
					:value="data?.funnel.conversionRate === null ? '—' : `${data?.funnel.conversionRate}%`"
					icon="chart"
					:trend="rateTrend"
					:hint="data?.funnel.conversionRate === null ? 'No visits yet' : 'Link visits that bought'"
					:loading="pending"
				/>
				<!-- The one tile the range tabs do not govern. A running total
				     has no comparable previous period, so it takes a hint
				     rather than an arrow — same rule as Overview's. -->
				<NuxtDashboardStatCard
					label="All time"
					:value="data?.counts.total ?? 0"
					:hint="allTimeHint"
				/>
			</div>

			<p class="dashNote">
				Commission, the 30-day hold and payouts are all handled by Whop. This page
				shows which sales came through your link — for anything about money, use
				the <a class="dashNote-link" href="https://whop.com/dashboard" target="_blank" rel="noopener noreferrer">Whop dashboard ↗</a>.
			</p>

			<div class="dashGrid">
				<section class="dashPanel dashGrid-main" :aria-busy="pending || undefined">
					<div class="dashPanel-head">
						<h2 class="dashPanel-title">Sales over time</h2>
						<span v-if="data" class="dashPanel-count">{{ data.timezone }}</span>
					</div>

					<NuxtDashboardBarChart
						v-if="data"
						:class="{ 'dash-refreshing': pending }"
						:points="series"
						unit="sales"
						unit-one="sale"
						:highlight-last="false"
					/>

					<p class="dashPanel-note">
						Bucketed in your own timezone, so a late-night sale lands on the day
						you'd say it happened rather than the day UTC would.
					</p>
				</section>

				<section class="dashPanel dashGrid-side" :aria-busy="pending || undefined">
					<h2 class="dashPanel-title">Visits to sales</h2>

					<!-- Three bars on one scale rather than three figures side
					     by side. The point of this panel is where people fall
					     out — whether they never opened the VIP link or opened
					     it and did not buy — and boxes of equal size say the
					     opposite of that. -->
					<ul class="funnel" :class="{ 'dash-refreshing': pending }">
						<li v-for="step in funnelSteps" :key="step.label" class="funnel-step">
							<div class="funnel-head">
								<span class="funnel-label">{{ step.label }}</span>
								<span class="funnel-value">{{ step.value }}</span>
							</div>
							<span class="funnel-bar" aria-hidden="true">
								<span
									class="funnel-fill"
									:class="{ 'is-lead': step.lead }"
									:style="{ transform: `scaleX(${step.share})` }"
								/>
							</span>
						</li>
					</ul>

					<p v-if="data?.funnel.conversionRate !== null" class="funnel-rate">
						<strong>{{ data?.funnel.conversionRate }}%</strong> of the people who
						opened your link went on to buy.
					</p>

					<p class="dashPanel-note">
						All three counted on our own server, once per person per day, so the
						steps compare like with like. Only the VIP link appears here — your
						Telegram and Calendly links send people somewhere useful, but nothing
						is sold through them, so a click on one is not a step towards a sale.
					</p>
				</section>
			</div>

			<section class="dashPanel">
				<div class="dashPanel-head">
					<h2 class="dashPanel-title">Who bought</h2>
					<span v-if="data?.sales.length" class="dashPanel-count">
						last {{ data.sales.length }}
					</span>
				</div>

				<p v-if="pending && !data" class="dashPanel-note">Loading…</p>

				<p v-else-if="!data?.sales.length" class="dashPanel-empty">
					No sales through your link yet. When someone buys, they'll appear here
					within a minute or two.
				</p>

				<table v-else class="dataTable">
					<thead>
						<tr>
							<th scope="col">Buyer</th>
							<th scope="col">When</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="sale in data.sales" :key="sale.id">
							<td>{{ sale.buyerUsername ?? "—" }}</td>
							<td>{{ formatDate(sale.occurredAt) }}</td>
						</tr>
					</tbody>
				</table>

				<p v-if="data?.sales.length" class="dashPanel-note">
					Whop usernames only — we don't share buyers' names or email addresses.
					This list is the most recent fifty, whatever range is selected above.
				</p>
			</section>
		</template>
	</div>
</template>

<script setup lang="ts">
import type { Trend } from "#shared/utils/trend";

interface SalesResponse {
	days: number;
	timezone: string;
	sales: { id: string; buyerUsername: string | null; status: string | null; occurredAt: string | null }[];
	counts: { total: number; thisMonth: number; window: number };
	funnel: { visits: number; vipClicks: number; sales: number; conversionRate: number | null };
	previous: { sales: number; visits: number; vipClicks: number; conversionRate: number | null };
	series: { day: string; sales: number }[];
}

const ranges = [
	{ id: "7", label: "7d" },
	{ id: "30", label: "30d" },
	{ id: "90", label: "90d" },
	{ id: "all", label: "All" },
] as const;

type RangeId = typeof ranges[number]["id"];

const range = useState<RangeId>("sales-range", () => "30");

const rangeQuery = computed(() =>
	(range.value === "all" ? { range: "all" } : { days: Number(range.value) }));

const { data, pending, error } = await useAsyncData<SalesResponse>(
	"affiliate-sales",
	() => $fetch<SalesResponse>("/api/affiliate/sales", {
		query: rangeQuery.value,
		headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
	}),
	{ watch: [range] },
);

// Follows the range rather than saying "last month" when the range is 7 days.
const priorLabel = computed(() =>
	(range.value === "all" ? "vs before" : `vs previous ${range.value} days`));

const salesTrend = computed(() =>
	(data.value ? trend(data.value.counts.window, data.value.previous.sales, priorLabel.value) : null));

const visitsTrend = computed(() =>
	(data.value ? trend(data.value.funnel.visits, data.value.previous.visits, priorLabel.value) : null));

/**
 * Conversion moves in percentage points, not percent.
 *
 * The shared helper would report 1.0% → 1.4% as "up 40%", which is true of the
 * ratio and reads as the rate having risen to 40. Points are the unambiguous
 * unit for the change in a percentage, so this one is built by hand rather than
 * bent out of `trend()` — the direction and the colouring are the same.
 */
const rateTrend = computed<Trend | null>(() => {
	const now = data.value?.funnel.conversionRate;
	const before = data.value?.previous.conversionRate;
	if (now === null || now === undefined || before === null || before === undefined) return null;

	const delta = Math.round((now - before) * 10) / 10;
	if (delta === 0) return { direction: "flat", text: `No change ${priorLabel.value}` };

	return {
		direction: delta > 0 ? "up" : "down",
		text: `${Math.abs(delta)} points ${priorLabel.value}`,
	};
});

const allTimeHint = computed(() => {
	if (!data.value?.counts.total) return null;
	const month = data.value.counts.thisMonth;
	return `${month.toLocaleString("en-GB")} this month`;
});

/**
 * The series, labelled for the axis.
 *
 * Day-of-month only. The bars are a few pixels apart at ninety days and a full
 * date under each one is an unreadable smear — the tooltip carries the rest.
 */
const series = computed(() =>
	(data.value?.series ?? []).map((point) => {
		const date = new Date(`${point.day}T00:00:00Z`);

		return {
			label: date.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" }),
			// The readout gets the whole date. Only every eighth axis label is
			// drawn, so on the other seven the bar is otherwise a number over
			// an unnamed column.
			title: date.toLocaleDateString("en-GB", {
				weekday: "short",
				day: "numeric",
				month: "short",
				timeZone: "UTC",
			}),
			value: point.sales,
		};
	}));

/**
 * Both steps on one scale, so the drop between them is the thing you see.
 *
 * Scaled against visits rather than each against itself: a sales bar drawn to
 * its own width would fill the panel and say the opposite of what the number
 * under it says. Floored, or a real sale against a lot of traffic renders as
 * nothing at all.
 */
const funnelSteps = computed(() => {
	const visits = data.value?.funnel.visits ?? 0;
	const clicks = data.value?.funnel.vipClicks ?? 0;
	const sales = data.value?.funnel.sales ?? 0;

	// Floored so a real figure is always a bar rather than a dot against the
	// track — at these ratios an honest width is often under a pixel, and a
	// mark too small to read as a mark reads as a rendering fault. The number
	// beside it is the exact one; this is the shape.
	const share = (value: number) =>
		(visits > 0 && value > 0 ? Math.max(value / visits, 0.02) : 0);

	return [
		{ label: "Link visits", value: visits.toLocaleString("en-GB"), share: 1, lead: false },
		{ label: "Opened the VIP link", value: clicks.toLocaleString("en-GB"), share: share(clicks), lead: false },
		{ label: "Bought", value: sales.toLocaleString("en-GB"), share: share(sales), lead: true },
	];
});

const formatDate = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
		: "—";
</script>
