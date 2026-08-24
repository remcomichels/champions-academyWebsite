<template>
	<NuxtAlertBanner v-if="error" variant="error">
		Could not load your links. Refresh to try again.
	</NuxtAlertBanner>

	<p v-else-if="!summary" class="dash-loading">Loading…</p>

	<NuxtDashboardLinks v-else :summary="summary" @refresh="refresh" />
</template>

<script setup lang="ts">
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Links & Assets",
	robots: "noindex, nofollow",
});

// Shares the "affiliate-summary" useAsyncData key with Overview, so arriving
// here from there is served from cache rather than refetching.
const { data: summary, error, refresh } = await useAffiliateSummary();
</script>
