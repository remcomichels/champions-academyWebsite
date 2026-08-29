<template>
	<div class="dashSection">
		<header class="dashHead">
			<h2 class="dashHead-title">Feedback</h2>

			<div class="rangeTabs">
				<button
					v-for="tab in tabs"
					:key="tab.value"
					type="button"
					class="rangeTabs-tab"
					:class="{ 'is-active': filter === tab.value }"
					@click="filter = tab.value"
				>
					{{ tab.label }}
				</button>
			</div>
		</header>

		<NuxtAlertBanner v-if="error" variant="error">
			Feedback didn't load. Try again in a moment.
		</NuxtAlertBanner>

		<p v-else-if="pending" class="dash-loading">Loading…</p>

		<p v-else-if="!shown.length" class="dashPanel-empty">
			{{ filter === "all" ? "Nothing has been sent yet." : `No ${filter}s yet.` }}
		</p>

		<ul v-else class="feedbackList">
			<li v-for="entry in shown" :key="entry.id" class="feedbackList-entry">
				<div class="feedbackList-head">
					<span class="feedbackList-kind" :class="`is-${entry.kind}`">{{ entry.kind }}</span>
					<span class="feedbackList-who">{{ entry.from?.displayName ?? "Unknown" }}</span>
					<span class="feedbackList-when">{{ formatWhen(entry.at) }}</span>
				</div>

				<p class="feedbackList-body">{{ entry.body }}</p>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
/**
 * The read side of the top bar's feedback button.
 *
 * Read-only on purpose — there is nothing to reply to, mark done or assign,
 * because the affiliate was told none of that would happen. Filtering happens
 * in the browser rather than by refetching: the endpoint caps at a hundred
 * entries, which is well inside what is worth holding in memory, and switching
 * tabs should not cost a request.
 */
definePageMeta({
	layout: "dashboard",
	middleware: ["auth", "admin"],
});

useSeoMeta({
	title: "Feedback",
	robots: "noindex, nofollow",
});

interface FeedbackEntry {
	id: number;
	at: string;
	kind: "issue" | "idea";
	body: string;
	from: { slug: string; displayName: string } | null;
}

const tabs = [
	{ value: "all", label: "All" },
	{ value: "issue", label: "Issues" },
	{ value: "idea", label: "Ideas" },
] as const;

const filter = ref<(typeof tabs)[number]["value"]>("all");

const { data, pending, error } = await useAsyncData<{ entries: FeedbackEntry[] }>(
	"admin-feedback",
	() => $fetch<{ entries: FeedbackEntry[] }>("/api/admin/feedback", {
		headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
	}),
);

const shown = computed(() => {
	const entries = data.value?.entries ?? [];
	return filter.value === "all" ? entries : entries.filter(entry => entry.kind === filter.value);
});

const formatWhen = (value: string) =>
	new Date(value).toLocaleDateString("en-GB", {
		day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
	});
</script>
