<template>
	<NuxtDashboardSettings section="logs" />
</template>

<script setup lang="ts">
/**
 * The account's own audit trail, moved off the Account page where it was a
 * five-row card. A log answers "what happened to my account, and when" — a
 * question that is only worth asking if you can see far enough back to answer
 * it, which is why it now has a page rather than a corner of one.
 */
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Audit Logs",
	robots: "noindex, nofollow",
});
</script>
