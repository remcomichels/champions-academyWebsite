<template>
	<NuxtDashboardSettings section="security" />
</template>

<script setup lang="ts">
/**
 * The two questions somebody asks when they think something is wrong: can I
 * change my password, and who else is signed in as me. They belong on one
 * screen because they are usually asked in that order.
 */
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Security",
	robots: "noindex, nofollow",
});
</script>
