<template>
	<div class="dashboard-placeholder">
		<h1>Dashboard</h1>
		<p>Affiliate dashboard — under construction.</p>
	</div>
</template>

<script setup lang="ts">
// Placeholder route. Its job right now is to exist so the no-store route rule
// in nuxt.config.ts has a real page to apply to — a 404 here would be served
// with Nuxt's own cache-control and hide a caching bug until launch.
// Auth middleware and the real tab shell land in S3/S4.
useSeoMeta({
	title: "Dashboard",
	robots: "noindex, nofollow",
});
</script>
