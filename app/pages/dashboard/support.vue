<template>
	<NuxtDashboardSupport />
</template>

<script setup lang="ts">
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Support",
	robots: "noindex, nofollow",
});
</script>
