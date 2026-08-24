<template>
	<NuxtAlertBanner v-if="error" variant="error">
		Could not load your dashboard. Refresh to try again.
	</NuxtAlertBanner>

	<p v-else-if="!summary" class="dash-loading">Loading…</p>

	<NuxtDashboardOverview v-else :summary="summary" @refresh="refresh" />
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

// The layout does not render this page at all without an affiliate profile, so
// the request can fire unconditionally — it can no longer 403 on an admin-only
// login the way it could when every tab lived on this one route.
const { data: summary, error, refresh } = await useAffiliateSummary();
</script>
