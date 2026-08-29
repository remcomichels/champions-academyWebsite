<template>
	<NuxtDashboardSettings section="preferences" />
</template>

<script setup lang="ts">
/**
 * What you can freely change about how the thing works: your name, your
 * timezone, your referral link, and the two data requests that are yours to
 * make. The account area's landing page, so the profile menu points here.
 *
 * All three tabs still render from `NuxtDashboardSettings`; see the note on its
 * `section` prop for why they are not three components.
 */
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Preferences",
	robots: "noindex, nofollow",
});
</script>
