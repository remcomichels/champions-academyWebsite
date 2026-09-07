<template>
	<!-- A standing mock of the affiliate dashboard, for the auth screens to
	     sit on.
	     Decorative and inert: no links, no inputs, nothing focusable, and
	     `aria-hidden` on the wrapper in the page.

	     Deliberately not a screenshot. /login is public, so a real capture would
	     ship one affiliate's figures as a static asset on it — and a screenshot
	     also freezes the theme, where this follows `data-theme` like everything
	     else and so works behind both the light and dark glass.

	     It mirrors the real page rather than approximating it: the rail is
	     `useDashboardNav`'s item list, the three stat cards and the "Link visits"
	     panel are `overview.vue`, and the figures are invented round numbers. -->
	<div class="dashGhost">
		<aside class="dashGhost-rail">
			<div class="dashGhost-brand">
				<span class="dashGhost-brandMark">CA</span>
				<span class="dashGhost-brandName">Champions Academy</span>
			</div>

			<nav class="dashGhost-nav">
				<span
					v-for="item in navItems"
					:key="item.label"
					class="dashGhost-navItem"
					:class="{ 'is-active': item.active }"
				>
					<NuxtDashboardIcon :name="item.icon" class="dashGhost-navIcon" />
					{{ item.label }}
				</span>
			</nav>

			<div class="dashGhost-nav dashGhost-nav--foot">
				<span class="dashGhost-navHeading">Account settings</span>
				<span v-for="item in footItems" :key="item.label" class="dashGhost-navItem">
					<NuxtDashboardIcon :name="item.icon" class="dashGhost-navIcon" />
					{{ item.label }}
				</span>
			</div>
		</aside>

		<div class="dashGhost-main">
			<header class="dashGhost-topbar">
				<span class="dashGhost-crumb">Overview</span>
				<span class="dashGhost-avatar">R</span>
			</header>

			<section class="dashGhost-hero">
				<div>
					<p class="dashGhost-heroTitle">Welcome back, Remco</p>
					<p class="dashGhost-heroSub">
						Share your link, and everyone who arrives through it is credited to
						you for 30 days.
					</p>
				</div>
				<div class="dashGhost-heroActions">
					<span class="dashGhost-btn dashGhost-btn--primary">Copy your link</span>
					<span class="dashGhost-btn">View analytics</span>
				</div>
			</section>

			<div class="dashGhost-stats">
				<div
					v-for="stat in stats"
					:key="stat.label"
					class="dashGhost-stat"
					:class="{ 'is-accent': stat.accent }"
				>
					<div class="dashGhost-statHead">
						<span class="dashGhost-statLabel">{{ stat.label }}</span>
						<NuxtDashboardIcon :name="stat.icon" class="dashGhost-statIcon" />
					</div>
					<p class="dashGhost-statValue">{{ stat.value }}</p>
					<p class="dashGhost-statTrend">{{ stat.trend }}</p>
				</div>
			</div>

			<div class="dashGhost-grid">
				<section class="dashGhost-panel">
					<div class="dashGhost-panelHead">
						<span class="dashGhost-panelTitle">Link visits</span>
						<div class="dashGhost-tabs">
							<span
								v-for="range in ranges"
								:key="range"
								class="dashGhost-tab"
								:class="{ 'is-active': range === '30 days' }"
							>{{ range }}</span>
						</div>
					</div>

					<div class="dashGhost-chart">
						<span
							v-for="(h, i) in series"
							:key="i"
							class="dashGhost-bar"
							:style="{ height: `${h}%` }"
						/>
					</div>

					<p class="dashGhost-note">
						Counted once per person per day, on our own server.
					</p>
				</section>

				<section class="dashGhost-side">
					<div v-for="card in highlights" :key="card.label" class="dashGhost-mini">
						<p class="dashGhost-miniLabel">{{ card.label }}</p>
						<p class="dashGhost-miniValue">{{ card.value }}</p>
					</div>
				</section>
			</div>

			<section class="dashGhost-panel">
				<div class="dashGhost-panelHead">
					<span class="dashGhost-panelTitle">Recent activity</span>
				</div>
				<div v-for="row in activity" :key="row.what" class="dashGhost-tr">
					<span class="dashGhost-td">{{ row.what }}</span>
					<span class="dashGhost-td dashGhost-td--muted">{{ row.when }}</span>
					<span class="dashGhost-td dashGhost-td--right">{{ row.count }}</span>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * Everything here is static. It is a picture of a dashboard, not a dashboard —
 * no store, no fetch, no reactivity, so it costs a render and nothing else.
 *
 * The figures are made up and rounded. They have to look plausible at a glance
 * and must not look like anybody's real numbers.
 */

const navItems = [
	{ label: "Overview", icon: "home", active: true },
	{ label: "Analytics", icon: "chart", active: false },
	{ label: "Links & Assets", icon: "link", active: false },
	{ label: "Support", icon: "help", active: false },
] as const;

const footItems = [
	{ label: "Preferences", icon: "cog" },
	{ label: "Security", icon: "shield" },
] as const;

const stats = [
	{ label: "Today", value: "48", icon: "home", trend: "+12% on yesterday", accent: true },
	{ label: "Last 30 days", value: "1,284", icon: "chart", trend: "+8% on last month", accent: false },
	{ label: "All time", value: "7,930", icon: "tag", trend: "Since March", accent: false },
] as const;

const ranges = ["7 days", "30 days", "90 days"] as const;

// A shape that reads as traffic — a working week with weekend dips — rather
// than noise. Fixed, so the server and the client render the same bars.
const series = [
	42, 58, 51, 66, 74, 38, 31,
	55, 69, 62, 78, 84, 45, 36,
	61, 72, 68, 88, 96, 52, 41,
	66, 79, 74, 91, 83, 47, 39,
];

const highlights = [
	{ label: "Top country", value: "Netherlands" },
	{ label: "Top source", value: "Instagram" },
	{ label: "Best day", value: "Thursday" },
	{ label: "Conversion", value: "4.2%" },
] as const;

const activity = [
	{ what: "Link opened", when: "2 minutes ago", count: "+1" },
	{ what: "Link opened", when: "18 minutes ago", count: "+1" },
	{ what: "Asset downloaded", when: "1 hour ago", count: "+3" },
] as const;
</script>
