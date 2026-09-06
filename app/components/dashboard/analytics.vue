<template>
	<div class="dashSection">
		<!-- The three figures sit directly on the page, not inside a panel of
		     their own. A card holding three cards reads as a box someone forgot
		     to remove, and it boxed the range tabs in with the figures when they
		     govern everything below them too. This matches Overview, where the
		     same three-up run is bare. -->
		<header class="dashHead">
			<h2 class="dashHead-title">Your traffic</h2>
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

		<NuxtAlertBanner v-if="trafficError" variant="error">
			Couldn't load your traffic just now. Try again in a minute.
		</NuxtAlertBanner>

		<div v-else class="statGrid">
			<NuxtDashboardStatCard
				label="Link visits"
				:value="traffic?.total ?? 0"
				icon="home"
				accent
				:trend="visitsTrend"
				hint="Counted on our own server"
				:loading="trafficPending"
			/>
			<NuxtDashboardStatCard
				label="Link clicks"
				:value="traffic?.clickTotal ?? 0"
				icon="chart"
				:trend="clicksTrend"
				hint="Tapped through to a plan"
				:loading="trafficPending"
			/>
			<NuxtDashboardStatCard
				v-if="showHouse"
				label="From the 50/50 split"
				:value="traffic?.houseTotal ?? 0"
				icon="tag"
				:trend="houseTrend"
				hint="Arrived without a link"
				:loading="trafficPending"
			/>
			<NuxtDashboardStatCard
				label="Countries"
				:value="traffic?.countryCount ?? 0"
				icon="tag"
				:trend="countriesTrend"
				:loading="trafficPending"
			/>
		</div>

		<p class="dashNote">
			<strong>Link visits</strong> is someone opening your link.
			<strong>Link clicks</strong> is them going on to tap one of your plans from
			there. Both are counted on our own server, once per person per day, so
			refreshing your own link won't inflate either and no ad blocker can thin
			them out — and the gap between the two is the people who arrived and went
			no further.
		</p>

		<p v-if="showHouse" class="dashNote">
			<strong>From the 50/50 split</strong> is people who reached the site
			without anyone's link and were shared evenly between the owners when they
			tapped a plan. They are already counted in <strong>Link visits</strong> —
			this is the part of it nobody referred, shown separately so the two are
			never confused.
		</p>

		<!-- Two rows of two. The heatmap sits in the narrower column because its
		     grid is a fixed width — given a wide column it would just carry dead
		     space to its right. -->
		<div class="dashGrid">
			<section class="dashPanel dashGrid-main" :aria-busy="trafficPending || undefined">
				<h2 class="dashPanel-title">Where they came from</h2>
				<NuxtDashboardDonut
					:class="{ 'dash-refreshing': trafficPending }"
					:items="sources"
					:period-label="priorLabel"
					empty="No sources yet. Once people start opening your link, the sites they came from show up here."
				/>
				<p class="dashPanel-note">
					<strong>Direct</strong> covers anyone whose browser didn't say where they
					came from — DMs, stories, QR scans and most apps all land there, so for
					most affiliates it's the biggest row rather than a gap in the data.
				</p>
			</section>

			<section class="dashPanel dashGrid-side" :aria-busy="trafficPending || undefined">
				<div class="dashPanel-head">
					<h2 class="dashPanel-title">When it gets opened</h2>
					<!-- Not dimmed with the grid: the timezone is a setting, not
					     a figure, and it reads the same for every range. -->
					<span v-if="traffic" class="dashPanel-count">{{ traffic.timezone }}</span>
				</div>

				<NuxtDashboardHeatmap
					v-if="traffic"
					:class="{ 'dash-refreshing': trafficPending }"
					:cells="traffic.heatmap"
					:timezone="traffic.timezone"
				/>

				<p class="dashPanel-note">
					Your timezone, set in Settings. Post when your audience is already
					awake and looking.
				</p>
			</section>
		</div>

		<div class="dashGrid">
			<section class="dashPanel dashGrid-main" :aria-busy="trafficPending || undefined">
				<div class="dashPanel-head">
					<h2 class="dashPanel-title">What they clicked</h2>
					<span
						v-if="clickRate !== null"
						class="dashPanel-count"
						:class="{ 'dash-refreshing': trafficPending }"
					>{{ clickRate }}% of visits</span>
				</div>
				<NuxtDashboardBreakdown
					:class="{ 'dash-refreshing': trafficPending }"
					:items="clicks"
					empty="No clicks yet. Once someone opens your link and taps through to a plan, it shows up here."
				/>
				<p class="dashPanel-note">
					Which of your links the traffic actually goes to. Counted once per
					person per day, like visits, so the rate above compares like with like.
				</p>
			</section>

			<section class="dashPanel dashGrid-side" :aria-busy="trafficPending || undefined">
				<h2 class="dashPanel-title">Where they are</h2>
				<NuxtDashboardBreakdown
					:class="{ 'dash-refreshing': trafficPending }"
					:items="countries"
					empty="No location data yet."
				/>
			</section>
		</div>

	</div>
</template>

<script setup lang="ts">
interface TrafficResponse {
	days: number;
	timezone: string;
	total: number;
	houseTotal: number;
	countryCount: number;
	clickTotal: number;
	previous: {
		total: number;
		houseTotal: number;
		countryCount: number;
		clickTotal: number;
		sources: { host: string | null; visits: number }[];
	};
	sources: { host: string | null; visits: number }[];
	countries: { country: string | null; visits: number }[];
	clicks: { role: string; clicks: number }[];
	heatmap: { dow: number; hour: number; visits: number }[];
}

const ranges = [
	{ id: "7", label: "7d" },
	{ id: "30", label: "30d" },
	{ id: "90", label: "90d" },
	{ id: "all", label: "All" },
] as const;

type RangeId = typeof ranges[number]["id"];

const range = useState<RangeId>("analytics-range", () => "30");

const rangeQuery = computed(() =>
	(range.value === "all" ? { range: "all" } : { days: Number(range.value) }));

const headers = () => (import.meta.server ? useRequestHeaders(["cookie"]) : undefined);

// Our own figures, and now the only ones on this page: server-side, and
// counted where an ad blocker cannot reach them.
const { data: traffic, pending: trafficPending, error: trafficError } =
	await useAsyncData<TrafficResponse>(
		"affiliate-traffic",
		() => $fetch<TrafficResponse>("/api/affiliate/traffic", {
			query: rangeQuery.value,
			headers: headers(),
		}),
		{ watch: [range] },
	);

// Each tile compares against the equally long window immediately before the
// selected one, so the label follows the range rather than saying "last month"
// when the range is 7 days.
const priorLabel = computed(() => {
	if (range.value === "all") return "vs before";
	return `vs previous ${range.value} days`;
});

const visitsTrend = computed(() =>
	(traffic.value ? trend(traffic.value.total, traffic.value.previous.total, priorLabel.value) : null));

const clicksTrend = computed(() =>
	(traffic.value
		? trend(traffic.value.clickTotal, traffic.value.previous.clickTotal, priorLabel.value)
		: null));

// Shown only to the affiliates in the house rotation. Driven by the figure
// itself rather than by a flag on the session: an owner taken out of the
// rotation keeps the tile while the window still contains their share, and
// loses it once it does not — which is the honest thing for it to do.
const showHouse = computed(() =>
	Boolean(traffic.value && (traffic.value.houseTotal > 0 || traffic.value.previous.houseTotal > 0)));

const houseTrend = computed(() =>
	(traffic.value
		? trend(traffic.value.houseTotal, traffic.value.previous.houseTotal, priorLabel.value)
		: null));

const countriesTrend = computed(() =>
	(traffic.value
		? trend(traffic.value.countryCount, traffic.value.previous.countryCount, priorLabel.value)
		: null));

/**
 * Each source with its own change, joined to the prior window by host.
 *
 * A host that had traffic last period and none now has no row here at all, and
 * gets none: the panel answers "where is my traffic coming from", and a source
 * sending nobody is not an answer to that. It is still inside the page total's
 * own trend, which is where a drop that size shows up.
 *
 * A null referrer host is direct traffic — DMs, stories and QR scans all land
 * there — not an unknown one.
 */
const sources = computed(() => {
	const before = new Map(
		(traffic.value?.previous.sources ?? []).map(row => [row.host, row.visits]),
	);

	return (traffic.value?.sources ?? []).map(row => ({
		label: row.host ?? "Direct",
		visits: row.visits,
		previousVisits: before.get(row.host) ?? 0,
	}));
});

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const countries = computed(() =>
	(traffic.value?.countries ?? []).map((row) => {
		// A null country is a visit whose location could not be resolved — a
		// VPN, a stripped header, a privacy browser. It used to be dropped, so
		// the list quietly summed to less than the visit total. Named, the same
		// way a null referrer is named "Direct".
		if (!row.country) return { label: "Unknown", visits: row.visits };

		let label: string = row.country;
		// Vercel sends ISO codes; an unrecognised one must not throw.
		try {
			label = regionNames.of(row.country) ?? row.country;
		}
		catch { /* keep the raw code */ }

		return { label, visits: row.visits };
	}));

// `calendly` is kept although nothing writes it any more. Thirty-five clicks
// were recorded against it before the booking link was removed, and they are
// still inside the windows this page can select — without the label they would
// render as the raw key. It goes when those rows age out.
const ROLE_LABELS: Record<string, string> = {
	lite: "Telegram (Lite)",
	calendly: "Book a call",
};

const clicks = computed(() =>
	(traffic.value?.clicks ?? []).map(row => ({
		label: ROLE_LABELS[row.role] ?? row.role,
		visits: row.clicks,
	})));

/**
 * Clicks as a share of visits. Both sides count once per person per day, so
 * this is a real rate rather than two differently-shaped numbers divided.
 * Can exceed 100% legitimately — one visitor may click two different links.
 */
const clickRate = computed(() => {
	const t = traffic.value;
	if (!t || !t.total) return null;
	return Math.round((t.clickTotal / t.total) * 100);
});
</script>
