<template>
	<div class="dashboard-placeholder">
		<h1>Dashboard</h1>
		<p v-if="affiliate">Signed in as {{ affiliate.displayName }} ({{ affiliate.slug }}).</p>
		<p>Affiliate dashboard — under construction.</p>
	</div>
</template>

<script setup lang="ts">
// Placeholder route. The real tab shell lands in S4; the auth guard is here
// now so this page is never reachable signed-out, even while it holds nothing.
//
// The guard is a redirect for the user's benefit, not the access control —
// every /api/* route checks the session itself, because route middleware runs
// in the browser on client-side navigation and can be skipped.
definePageMeta({
	middleware: "auth",
});

useSeoMeta({
	title: "Dashboard",
	robots: "noindex, nofollow",
});

const { affiliate } = useAuth();
</script>
