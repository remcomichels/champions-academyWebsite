<template>
	<NuxtDashboardSettings section="preferences" />
</template>

<script setup lang="ts">
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Settings",
	robots: "noindex, nofollow",
});
</script>
