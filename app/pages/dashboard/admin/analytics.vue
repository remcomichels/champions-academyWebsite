<template>
	<NuxtDashboardAdminAnalytics />
</template>

<script setup lang="ts">
definePageMeta({
	layout: "dashboard",
	middleware: "admin",
});

useSeoMeta({
	title: "Programme analytics",
	robots: "noindex, nofollow",
});
</script>
