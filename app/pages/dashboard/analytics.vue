<template>
	<NuxtDashboardAnalytics />
</template>

<script setup lang="ts">
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Analytics",
	robots: "noindex, nofollow",
});
</script>
