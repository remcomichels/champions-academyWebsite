<template>
	<div class="dashSection">
		<header class="dashHead">
			<h2 class="dashHead-title">The programme</h2>
			<div class="rangeTabs">
				<button
					v-for="option in RANGES"
					:key="option.id"
					type="button"
					class="rangeTabs-tab"
					:class="{ 'is-active': days === option.id }"
					@click="days = option.id"
				>
					{{ option.label }}
				</button>
			</div>
		</header>

		<NuxtAlertBanner v-if="failed" variant="error">
			Couldn't load the programme figures just now. Try again in a minute.
		</NuxtAlertBanner>

		<template v-else>
			<div class="statGrid">
				<NuxtDashboardStatCard
					label="Link visits"
					:value="data?.totals.visits ?? 0"
					icon="home"
					accent
					:trend="data?.trends.visits ?? null"
					hint="Everyone's links, counted on our server"
					:loading="pending"
				/>
				<NuxtDashboardStatCard
					label="Plan clicks"
					:value="data?.totals.clicks ?? 0"
					icon="link"
					:trend="data?.trends.clicks ?? null"
					hint="Tapped through to a plan"
					:loading="pending"
				/>
				<NuxtDashboardStatCard
					label="Sales"
					:value="data?.totals.sales ?? 0"
					icon="tag"
					:trend="data?.trends.sales ?? null"
					hint="Attributed through Whop"
					:loading="pending"
				/>
				<NuxtDashboardStatCard
					label="Affiliates with traffic"
					:value="data?.totals.affiliatesActive ?? 0"
					icon="shield"
					:trend="data?.trends.active ?? null"
					:hint="activeHint"
					:loading="pending"
				/>
			</div>

			<p class="dashNote">
				Every figure here is counted on our own server and totalled across all
				affiliates, so no ad blocker thins it out. Bucketed in <strong>UTC</strong>
				rather than anyone's local time — a programme spanning several timezones
				has no single one of its own, and borrowing one affiliate's would shift
				everybody else's days.
			</p>

			<section class="dashPanel" :aria-busy="pending || undefined">
				<div class="dashPanel-head">
					<h2 class="dashPanel-title">Visits a day</h2>
					<span class="dashPanel-count">{{ days }} days</span>
				</div>
				<NuxtDashboardBarChart
					:class="{ 'dash-refreshing': pending }"
					:points="series"
					unit="visits"
					unit-one="visit"
					caption="Across every affiliate."
				/>
			</section>

			<div class="dashGrid">
				<section class="dashPanel dashGrid-main" :aria-busy="pending || undefined">
					<div class="dashPanel-head">
						<h2 class="dashPanel-title">Who's carrying it</h2>
						<span class="dashPanel-count">Top {{ leaders.length }}</span>
					</div>

					<p v-if="!leaders.length" class="dashPanel-empty">
						No affiliate has had traffic in this window yet.
					</p>

					<!-- Every bar is the same hue on purpose. Length is the ranking;
					     a colour per affiliate would tie identity to rank, so
					     changing the range would repaint everyone. -->
					<ol v-else class="leaderboard" :class="{ 'dash-refreshing': pending }">
						<li v-for="row in leaders" :key="row.id" class="leaderboard-row">
							<span class="leaderboard-rank">{{ row.rank }}</span>

							<span class="leaderboard-who">
								<span class="leaderboard-name">
									<!-- The name truncates; the flag must not. Inside the
									     ellipsis container it was the thing that got cut. -->
									<span class="leaderboard-nameText">{{ row.displayName }}</span>
									<span v-if="row.status !== 'active'" class="leaderboard-flag">Revoked</span>
								</span>
								<span class="leaderboard-slug">?r={{ row.slug }}</span>
							</span>

							<span class="leaderboard-track" aria-hidden="true">
								<span class="leaderboard-fill" :style="{ transform: `scaleX(${row.share})` }" />
							</span>

							<span class="leaderboard-figures">
								<span class="leaderboard-sales">{{ row.salesLabel }}</span>
								<span class="leaderboard-sub">{{ row.visitsLabel }} visits · {{ row.clicksLabel }} clicks</span>
							</span>
						</li>
					</ol>

					<p class="dashPanel-note">
						Ranked on sales, then visits to separate everyone still on zero.
						Revoked affiliates stay listed — their traffic happened, and
						dropping them would make this disagree with the totals above.
					</p>
				</section>

				<section class="dashPanel dashGrid-side" :aria-busy="pending || undefined">
					<h2 class="dashPanel-title">Where it falls out</h2>

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

					<p class="dashPanel-note">
						Three steps of one journey, so each bar is measured against the
						visits above it rather than against its own kind.
					</p>
				</section>
			</div>

			<div class="dashGrid">
				<section class="dashPanel dashGrid-main" :aria-busy="pending || undefined">
					<h2 class="dashPanel-title">Where they came from</h2>
					<NuxtDashboardDonut
						:class="{ 'dash-refreshing': pending }"
						:items="data?.sources ?? []"
						:period-label="periodLabel"
						empty="No traffic in this window yet."
					/>
					<p class="dashPanel-note">
						<strong>Direct</strong> covers anyone whose browser didn't say where
						they came from — DMs, stories and QR scans all land there, so it is
						usually the biggest row rather than a gap in the data.
					</p>
				</section>

				<section class="dashPanel dashGrid-side" :aria-busy="pending || undefined">
					<h2 class="dashPanel-title">Countries</h2>
					<NuxtDashboardBreakdown
						:class="{ 'dash-refreshing': pending }"
						:items="countries"
						empty="No countries recorded in this window yet."
					/>
				</section>
			</div>

			<section class="dashPanel" :aria-busy="pending || undefined">
				<div class="dashPanel-head">
					<h2 class="dashPanel-title">Sales a day</h2>
					<span class="dashPanel-count">{{ data?.totals.sales ?? 0 }} total</span>
				</div>
				<!-- Its own chart rather than a second series on the visits one.
				     Sales and visits sit orders of magnitude apart, and putting
				     them on two y-scales is the one thing a chart may never do. -->
				<NuxtDashboardBarChart
					:class="{ 'dash-refreshing': pending }"
					:points="salesSeries"
					unit="sales"
					unit-one="sale"
					caption="Attributed through the Whop webhook."
				/>
			</section>
		</template>
	</div>
</template>

<script setup lang="ts">
import { useAdminAnalytics, RANGES } from "~/assets/js/components/adminAnalytics";

const {
	days, data, pending, failed, load,
	series, salesSeries, funnelSteps, leaders, countries,
	periodLabel, activeHint,
} = useAdminAnalytics();

await load();
</script>
