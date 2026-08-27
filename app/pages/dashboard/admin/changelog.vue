<template>
	<div class="dashSection">
		<header class="dashHead">
			<h2 class="dashHead-title">Changelog</h2>
		</header>

		<section class="dashPanel">
			<h3 class="dashPanel-title">Write an entry</h3>

			<NuxtAlertBanner v-if="banner" :variant="banner.variant">{{ banner.text }}</NuxtAlertBanner>

			<form class="dashForm" novalidate @submit.prevent="save(false)">
				<NuxtAuthField v-model="title" label="Title" :error="errors.title" required />

				<div class="field">
					<label class="field-label" for="changelog-body">What changed</label>
					<textarea
						id="changelog-body"
						v-model="body"
						class="field-input feedback-text"
						rows="6"
						:maxlength="8000"
						placeholder="A line or two on what's new. Line breaks are kept."
					/>
					<p v-if="errors.body" class="field-message is-error">{{ errors.body }}</p>
				</div>

				<div class="feedback-actions">
					<button type="button" class="btn btn--ghost" :disabled="busy" @click="save(true)">
						Save as draft
					</button>
					<button type="submit" class="btn btn--primary" :disabled="busy">
						{{ busy ? "Saving…" : "Publish" }}
					</button>
				</div>
			</form>
		</section>

		<section class="dashSection">
			<h3 class="dashPanel-title">Published</h3>

			<p v-if="pending" class="dash-loading">Loading…</p>

			<p v-else-if="!entries.length" class="dashPanel-empty">
				Nothing published yet.
			</p>

			<ol v-else class="changelog">
				<li v-for="entry in entries" :key="entry.id" class="changelog-entry">
					<p class="changelog-when">
						<time :datetime="entry.at">{{ formatDate(entry.at) }}</time>
					</p>
					<div class="changelog-copy">
						<h4 class="changelog-title">{{ entry.title }}</h4>
						<p class="changelog-body">{{ entry.body }}</p>
					</div>
				</li>
			</ol>
		</section>
	</div>
</template>

<script setup lang="ts">
/**
 * Where release notes get written.
 *
 * Append-only: there is no edit or delete, because a changelog is a record of
 * what happened and quietly rewriting one defeats the point of keeping it. A
 * mistake is corrected by publishing a correction.
 *
 * The list below the form is the published feed — the same endpoint affiliates
 * read, so what an admin sees here is exactly what shipped. Drafts are not
 * listed for the same reason: nothing reads them yet, and showing them would
 * imply a way to publish one, which there isn't.
 */
definePageMeta({
	layout: "dashboard",
	middleware: ["auth", "admin"],
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

const title = ref("");
const body = ref("");
const busy = ref(false);
const banner = ref<{ variant: "success" | "error"; text: string } | null>(null);
const errors = reactive<{ title?: string; body?: string }>({});

const { data, pending, refresh } = await useAsyncData<{ entries: ChangelogEntry[] }>(
	"admin-changelog",
	() => $fetch<{ entries: ChangelogEntry[] }>("/api/changelog", {
		headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
	}),
);

const entries = computed(() => data.value?.entries ?? []);

const save = async (draft = false) => {
	errors.title = undefined;
	errors.body = undefined;
	banner.value = null;

	if (!title.value.trim()) errors.title = "Give it a title.";
	if (!body.value.trim()) errors.body = "Say what changed.";
	if (errors.title || errors.body) return;

	busy.value = true;

	try {
		await $fetch("/api/admin/changelog", {
			method: "POST",
			body: {
				title: title.value.trim(),
				body: body.value.trim(),
				// The endpoint reads this as a string, so the flag is only ever
				// sent when it is actually set.
				...(draft ? { draft: "true" } : {}),
			},
		});

		title.value = "";
		body.value = "";
		banner.value = {
			variant: "success",
			text: draft ? "Saved as a draft — nobody can see it yet." : "Published.",
		};

		if (!draft) await refresh();
	}
	catch {
		banner.value = { variant: "error", text: "That didn't save. Try again in a moment." };
	}
	finally {
		busy.value = false;
	}
};

const formatDate = (value: string) =>
	new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
</script>
