<template>
	<div class="dashSection">
		<NuxtAlertBanner v-if="data && !data.configured" variant="info">
			Analytics isn't switched on for this environment yet.
		</NuxtAlertBanner>

		<section class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">Sessions</h2>
				<div class="rangeTabs">
					<button
						v-for="option in ranges"
						:key="option.id"
						type="button"
						class="rangeTabs-tab"
						:class="{ 'is-active': range === option.id }"
						@click="setRange(option.id)"
					>
						{{ option.label }}
					</button>
				</div>
			</div>

			<p v-if="pending" class="dashPanel-note">Loading…</p>
			<NuxtAlertBanner v-else-if="error" variant="error">
				Couldn't load analytics just now. Try again in a minute.
			</NuxtAlertBanner>

			<div v-else-if="data" class="statGrid">
				<NuxtDashboardStatCard
					label="Sessions"
					:value="data.sessions"
					hint="Separate visits to the site"
				/>
			</div>

			<p class="dashPanel-note">
				A session is one continuous visit. For how many people arrived through your
				link, use <strong>Link visits</strong> on Overview — that's counted on our
				own server, so nothing can block it. Sessions are measured in the browser
				and will always be the lower number.
			</p>
		</section>

		<section v-if="data?.configured" class="dashPanel">
			<h2 class="dashPanel-title">Where they are</h2>

			<ul v-if="data.countries.length" class="geoList">
				<li v-for="row in data.countries" :key="row.country" class="geoList-row">
					<span class="geoList-name">{{ row.country }}</span>
					<span class="geoList-bar" aria-hidden="true">
						<span class="geoList-fill" :style="{ transform: `scaleX(${share(row.sessions)})` }" />
					</span>
					<span class="geoList-count">{{ row.sessions }}</span>
				</li>
			</ul>

			<p v-else class="dashPanel-empty">
				No location data yet. It appears once people start arriving through your link.
			</p>
		</section>
	</div>
</template>

<script setup lang="ts">
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

const { data, pending, error, refresh } = await useAsyncData<AnalyticsResponse>(
	"affiliate-analytics",
	() => $fetch<AnalyticsResponse>("/api/affiliate/analytics", {
		// "all" is resolved server-side from the affiliate's join date, so the
		// client never decides how far back to look.
		query: range.value === "all" ? { range: "all" } : { days: Number(range.value) },
		headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
	}),
	{ watch: [range] },
);

const setRange = (value: RangeId) => {
	range.value = value;
	refresh();
};

/** Bar width relative to the busiest country, floored so one session is visible. */
const share = (sessions: number) => {
	const top = data.value?.countries[0]?.sessions ?? 0;
	return top > 0 ? Math.max(sessions / top, 0.04) : 0;
};
</script>
