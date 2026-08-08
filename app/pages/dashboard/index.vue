<template>
	<div class="dash">
		<header class="dash-head">
			<p class="dash-preTitle">Affiliate dashboard</p>
			<h1 class="dash-title">{{ summary?.affiliate.displayName ?? "Dashboard" }}</h1>
		</header>

		<nav class="dashTabs" aria-label="Dashboard sections">
			<button
				v-for="tab in tabs"
				:key="tab.id"
				type="button"
				class="dashTabs-tab"
				:class="{ 'is-active': activeTab === tab.id }"
				:aria-current="activeTab === tab.id ? 'page' : undefined"
				@click="activeTab = tab.id"
			>
				{{ tab.label }}
			</button>
		</nav>

		<NuxtAlertBanner v-if="error" variant="error">
			Could not load your dashboard. Refresh to try again.
		</NuxtAlertBanner>

		<p v-else-if="!summary" class="dash-loading">Loading…</p>

		<template v-else>
			<NuxtDashboardOverview v-if="activeTab === 'overview'" :summary="summary" @refresh="refresh" />
			<NuxtDashboardLinks v-else-if="activeTab === 'links'" :summary="summary" @refresh="refresh" />
			<NuxtDashboardComingSoon
				v-else-if="activeTab === 'analytics'"
				title="Analytics"
				note="Visitor numbers, sessions and where in the world your traffic comes from. Not switched on yet."
			/>
			<NuxtDashboardComingSoon
				v-else-if="activeTab === 'sales'"
				title="Sales"
				note="Who bought through your link, and how visits turn into sales. Not switched on yet."
			/>
			<NuxtDashboardComingSoon
				v-else-if="activeTab === 'settings'"
				title="Settings"
				note="Your profile, password, two-factor login and privacy controls. Not switched on yet."
			/>
			<NuxtDashboardComingSoon
				v-else
				title="Support"
				note="Message us directly, plus answers to the usual questions. Not switched on yet."
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Affiliate dashboard",
	robots: "noindex, nofollow",
});

const tabs = [
	{ id: "overview", label: "Overview" },
	{ id: "analytics", label: "Analytics" },
	{ id: "sales", label: "Sales" },
	{ id: "links", label: "Links & Assets" },
	{ id: "settings", label: "Settings" },
	{ id: "support", label: "Support" },
] as const;

type TabId = typeof tabs[number]["id"];

// useState rather than a local ref so the chosen tab survives a soft
// navigation away and back.
const activeTab = useState<TabId>("dash-tab", () => "overview");

const { data: summary, error, refresh } = await useAffiliateSummary();
</script>
