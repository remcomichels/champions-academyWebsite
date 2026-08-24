<template>
	<div class="dashSection">
		<section class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">Your traffic</h2>
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
			</div>

			<p v-if="trafficPending" class="dashPanel-note">Loading…</p>
			<NuxtAlertBanner v-else-if="trafficError" variant="error">
				Couldn't load your traffic just now. Try again in a minute.
			</NuxtAlertBanner>

			<div v-else class="statGrid">
				<NuxtDashboardStatCard
					label="Link visits"
					:value="traffic?.total ?? 0"
					icon="home"
					accent
					hint="Counted on our own server"
				/>
				<NuxtDashboardStatCard
					label="Sessions"
					:value="analytics?.configured ? analytics.sessions : '—'"
					icon="chart"
					:hint="analytics?.configured ? 'Measured in the browser' : 'Analytics not switched on here'"
				/>
				<NuxtDashboardStatCard
					label="Countries"
					:value="traffic?.countries.length ?? 0"
					icon="tag"
				/>
			</div>

			<p class="dashPanel-note">
				<strong>Link visits</strong> is your real number — counted on our server when
				someone opens your link, once per person per day, where nothing can block it.
				<strong>Sessions</strong> is measured in the browser and misses anyone using
				an ad blocker, so it will always be lower. Neither is wrong.
			</p>
		</section>

		<!-- ── When ────────────────────────────────────────────────────────── -->
		<section class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">When your link gets opened</h2>
				<span v-if="traffic" class="dashPanel-count">{{ traffic.timezone }}</span>
			</div>

			<NuxtDashboardHeatmap
				v-if="traffic"
				:cells="traffic.heatmap"
				:timezone="traffic.timezone"
			/>

			<p class="dashPanel-note">
				Shown in your timezone, which you can change in Settings. Post when your
				audience is already awake and looking.
			</p>
		</section>

		<!-- ── Where from / where to ───────────────────────────────────────── -->
		<div class="dashGrid">
			<section class="dashPanel dashGrid-main">
				<h2 class="dashPanel-title">Where they came from</h2>
				<NuxtDashboardBreakdown
					:items="sources"
					empty="No sources yet. Once people start opening your link, the sites they came from show up here."
				/>
				<p class="dashPanel-note">
					<strong>Direct</strong> covers anyone whose browser didn't say where they
					came from — DMs, stories, QR scans and most apps all land there, so for
					most affiliates it's the biggest row rather than a gap in the data.
				</p>
			</section>

			<section class="dashPanel dashGrid-side">
				<h2 class="dashPanel-title">Where they are</h2>
				<NuxtDashboardBreakdown
					:items="countries"
					empty="No location data yet."
				/>
			</section>
		</div>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Which page they landed on</h2>
			<NuxtDashboardBreakdown
				:items="paths"
				empty="No landing pages yet."
			/>
			<p class="dashPanel-note">
				Where your link pointed people. If you're sharing a link to a specific page,
				this is how you check it's actually the one they're getting.
			</p>
		</section>
	</div>
</template>

<script setup lang="ts">
interface TrafficResponse {
	days: number;
	timezone: string;
	total: number;
	sources: { host: string | null; visits: number }[];
	countries: { country: string; visits: number }[];
	paths: { path: string; visits: number }[];
	heatmap: { dow: number; hour: number; visits: number }[];
}

interface AnalyticsResponse {
	configured: boolean;
	days: number;
	sessions: number;
	countries: { country: string; sessions: number }[];
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

// PostHog, for the session count only. Its country list is deliberately unused:
// we have the same breakdown from our own server, where an ad blocker cannot
// thin it out, and two different "where they are" lists on one page is the
// confusion we already removed once.
const { data: analytics } = await useAsyncData<AnalyticsResponse>(
	"affiliate-analytics",
	() => $fetch<AnalyticsResponse>("/api/affiliate/analytics", {
		query: rangeQuery.value,
		headers: headers(),
	}),
	{ watch: [range] },
);

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

const paths = computed(() =>
	(traffic.value?.paths ?? []).map(row => ({
		label: row.path,
		visits: row.visits,
	})));
</script>
