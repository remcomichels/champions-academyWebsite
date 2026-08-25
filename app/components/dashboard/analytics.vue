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

		<!-- Each card waits on its own request rather than on both. The session
		     count comes from PostHog and the other two from our own database, so
		     tying all three to the slower of the pair would hold two finished
		     figures back for no reason. They settle at different moments, which
		     is invisible: the placeholder occupies the same box the figure does. -->
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
				label="Sessions"
				:value="analytics?.configured ? analytics.sessions : '—'"
				icon="chart"
				:trend="sessionsTrend"
				:hint="analytics?.configured ? 'Measured in the browser' : 'Analytics not switched on here'"
				:loading="analyticsPending"
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
			<strong>Link visits</strong> is your real number — counted on our server when
			someone opens your link, once per person per day, where nothing can block it.
			<strong>Sessions</strong> is measured in the browser and misses anyone using
			an ad blocker, so it will always be lower. Neither is wrong.
		</p>

		<!-- Two rows of two. The heatmap sits in the narrower column because its
		     grid is a fixed width — given a wide column it would just carry dead
		     space to its right. -->
		<div class="dashGrid">
			<section class="dashPanel dashGrid-main" :aria-busy="trafficPending || undefined">
				<h2 class="dashPanel-title">Where they came from</h2>
				<NuxtDashboardBreakdown
					:class="{ 'dash-refreshing': trafficPending }"
					:items="sources"
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
	countryCount: number;
	clickTotal: number;
	previous: { total: number; countryCount: number; clickTotal: number };
	sources: { host: string | null; visits: number }[];
	countries: { country: string; visits: number }[];
	clicks: { role: string; clicks: number }[];
	heatmap: { dow: number; hour: number; visits: number }[];
}

interface AnalyticsResponse {
	configured: boolean;
	days: number;
	sessions: number;
	previousSessions: number;
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

// Our own figures. Server-side, unblockable, and the source for everything on
// this page except the session count.
const { data: traffic, pending: trafficPending, error: trafficError } =
	await useAsyncData<TrafficResponse>(
		"affiliate-traffic",
		() => $fetch<TrafficResponse>("/api/affiliate/traffic", {
			query: rangeQuery.value,
			headers: headers(),
		}),
		{ watch: [range] },
	);

// PostHog, for the session count only. Its country breakdown was dropped from
// the query entirely: we have the same figures from our own server where an ad
// blocker cannot thin them out, and two different "where they are" lists on one
// page is the confusion we already removed once.
const { data: analytics, pending: analyticsPending } = await useAsyncData<AnalyticsResponse>(
	"affiliate-analytics",
	() => $fetch<AnalyticsResponse>("/api/affiliate/analytics", {
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

const countriesTrend = computed(() =>
	(traffic.value
		? trend(traffic.value.countryCount, traffic.value.previous.countryCount, priorLabel.value)
		: null));

const sessionsTrend = computed(() =>
	(analytics.value?.configured
		? trend(analytics.value.sessions, analytics.value.previousSessions, priorLabel.value)
		: null));

/** A null referrer host is direct traffic, not an unknown one. */
const sources = computed(() =>
	(traffic.value?.sources ?? []).map(row => ({
		label: row.host ?? "Direct",
		visits: row.visits,
	})));

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const countries = computed(() =>
	(traffic.value?.countries ?? []).map((row) => {
		let label = row.country;
		// Vercel sends ISO codes; an unrecognised one must not throw.
		try {
			label = regionNames.of(row.country) ?? row.country;
		}
		catch { /* keep the raw code */ }

		return { label, visits: row.visits };
	}));

const ROLE_LABELS: Record<string, string> = {
	vip: "VIP checkout",
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
