<template>
	<NuxtDashboardHerofx />
</template>

<script setup lang="ts">
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "HeroFX IB",
	robots: "noindex, nofollow",
});
</script>
