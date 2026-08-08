<template>
	<div class="dashSection">
		<NuxtAlertBanner v-if="data && !data.configured" variant="info">
			Analytics isn't switched on for this environment yet.
		</NuxtAlertBanner>

		<section class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">Your traffic</h2>
				<div class="rangeTabs">
					<button
						v-for="option in ranges"
						:key="option"
						type="button"
						class="rangeTabs-tab"
						:class="{ 'is-active': days === option }"
						@click="setDays(option)"
					>
						{{ option }}d
					</button>
				</div>
			</div>

			<p v-if="pending" class="dashPanel-note">Loading…</p>
			<NuxtAlertBanner v-else-if="error" variant="error">
				Couldn't load analytics just now. Try again in a minute.
			</NuxtAlertBanner>

			<div v-else-if="data" class="statGrid">
				<NuxtDashboardStatCard
					label="Unique visitors"
					:value="data.visitors"
					hint="People, not pageviews"
				/>
				<NuxtDashboardStatCard
					label="Sessions"
					:value="data.sessions"
					hint="Separate visits"
				/>
			</div>

			<p class="dashPanel-note">
				Everyone who reached the site through your link. Counted by PostHog, so
				these can differ slightly from the visit numbers on Overview — those come
				from our own server and ignore anyone blocking analytics.
			</p>
		</section>

		<section v-if="data?.configured" class="dashPanel">
			<h2 class="dashPanel-title">Where they are</h2>

			<ul v-if="data.countries.length" class="geoList">
				<li v-for="row in data.countries" :key="row.country" class="geoList-row">
					<span class="geoList-name">{{ row.country }}</span>
					<span class="geoList-bar" aria-hidden="true">
						<span class="geoList-fill" :style="{ transform: `scaleX(${share(row.visitors)})` }" />
					</span>
					<span class="geoList-count">{{ row.visitors }}</span>
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
	visitors: number;
	sessions: number;
	countries: { country: string; visitors: number }[];
}

const ranges = [7, 30, 90] as const;
const days = useState<number>("analytics-days", () => 30);

const { data, pending, error, refresh } = await useAsyncData<AnalyticsResponse>(
	"affiliate-analytics",
	() => $fetch<AnalyticsResponse>("/api/affiliate/analytics", {
		query: { days: days.value },
		headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
	}),
	{ watch: [days] },
);

const setDays = (value: number) => {
	days.value = value;
	refresh();
};

/** Bar width relative to the busiest country, floored so 1 visitor is visible. */
const share = (visitors: number) => {
	const top = data.value?.countries[0]?.visitors ?? 0;
	return top > 0 ? Math.max(visitors / top, 0.04) : 0;
};
</script>
