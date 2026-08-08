<template>
	<div class="dash">
		<header class="dash-head">
			<p class="dash-preTitle">Affiliate dashboard</p>
			<h1 class="dash-title">{{ summary?.affiliate.displayName ?? "Dashboard" }}</h1>
		</header>

		<nav v-if="hasAffiliate" class="dashTabs" aria-label="Dashboard sections">
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

		<!-- An admin-only login has no affiliate profile, so there are no figures
		     to show. Saying that plainly beats a generic failure, which is what
		     the owner would otherwise hit every time they open their own site. -->
		<div v-if="!hasAffiliate" class="dashSection">
			<section class="dashPanel">
				<h2 class="dashPanel-title">No affiliate profile on this account</h2>
				<p class="dashPanel-note">
					This login isn't attached to an affiliate, so there are no referral
					figures to show. That's expected for an admin account.
				</p>
				<NuxtLink v-if="isAdmin" to="/dashboard/admin" class="dashPanel-cta">
					Go to the admin panel
				</NuxtLink>
			</section>
		</div>

		<NuxtAlertBanner v-else-if="error" variant="error">
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

const { affiliate, isAdmin, fetchMe } = useAuth();

// The layout awaits this too, but a page must not depend on layout setup order.
// It is cached in useState, so the second call costs nothing.
await fetchMe();

const hasAffiliate = computed(() => Boolean(affiliate.value));

const { data: summary, error, refresh } = await useAffiliateSummary({
	immediate: hasAffiliate.value,
});
</script>
