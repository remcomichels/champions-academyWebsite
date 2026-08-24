<template>
	<NuxtDashboardSales />
</template>

<script setup lang="ts">
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Sales",
	robots: "noindex, nofollow",
});
</script>
