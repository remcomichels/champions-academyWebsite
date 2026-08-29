<template>
	<div class="dashSection">
		<header class="dashHead">
			<h2 class="dashHead-title">Changelog</h2>
		</header>

		<NuxtAlertBanner v-if="error" variant="error">
			The changelog didn't load. Try again in a moment.
		</NuxtAlertBanner>

		<p v-else-if="pending" class="dash-loading">Loading…</p>

		<p v-else-if="!entries.length" class="dashPanel-empty">
			Nothing here yet. Updates to the dashboard will show up on this page.
		</p>

		<!-- One rule per entry rather than a card each: this is a list read top
		     to bottom, and a run of outlined boxes would make each note look
		     like a separate object rather than a dated line in a record. -->
		<ol v-else class="changelog">
			<li v-for="entry in entries" :key="entry.id" class="changelog-entry">
				<p class="changelog-when">
					<time :datetime="entry.at">{{ formatDate(entry.at) }}</time>
				</p>

				<div class="changelog-copy">
					<h3 class="changelog-title">{{ entry.title }}</h3>
					<p class="changelog-body">{{ entry.body }}</p>
				</div>
			</li>
		</ol>
	</div>
</template>

<script setup lang="ts">
definePageMeta({
	layout: "dashboard",
	middleware: "auth",
});

useSeoMeta({
	title: "Changelog",
	robots: "noindex, nofollow",
});

interface ChangelogEntry {
	id: number;
	at: string;
	title: string;
	body: string;
}

const { data, pending, error } = await useAsyncData<{ entries: ChangelogEntry[] }>(
	"changelog",
	() => $fetch<{ entries: ChangelogEntry[] }>("/api/changelog", {
		headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
	}),
);

const entries = computed(() => data.value?.entries ?? []);

const formatDate = (value: string) =>
	new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
</script>
