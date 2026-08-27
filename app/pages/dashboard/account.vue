<template>
	<NuxtDashboardSettings section="account" />
</template>

<script setup lang="ts">
/**
 * Identity and security — the half of the old Settings page that answers "who
 * is this account", as opposed to "how do I want it to behave". Both halves
 * still render from `NuxtDashboardSettings`; see the note on its `section` prop
 * for why they are not two components.
 */
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Account",
	robots: "noindex, nofollow",
});
</script>
