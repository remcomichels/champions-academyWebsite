<template>
	<!-- Never rendered — the middleware below redirects before this mounts. -->
	<div />
</template>

<script setup lang="ts">
/**
 * Settings and Account merged into one area, and this is the old door.
 *
 * Kept as a redirect rather than deleted: it is the path the profile menu
 * pointed at for the whole life of the dashboard, so it is in browser histories
 * and autocomplete. A 404 for a URL that worked yesterday is a worse outcome
 * than a file that does nothing but forward.
 */
definePageMeta({
	layout: "dashboard",
	middleware: [() => navigateTo("/dashboard/account", { redirectCode: 302 })],
});
</script>
