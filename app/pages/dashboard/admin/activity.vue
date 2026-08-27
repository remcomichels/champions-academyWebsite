<template>
	<div class="dash">
		<header class="dash-head">
			<p class="dash-preTitle">Admin</p>
			<h2 class="dash-title">Activity</h2>
		</header>

		<NuxtAlertBanner v-if="error" variant="error">{{ error }}</NuxtAlertBanner>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Filter</h2>
			<p class="dashPanel-note">
				Pick an affiliate to see only what happened to them. Revoked accounts
				are listed too — those are usually the ones worth reading.
			</p>

			<input
				v-model="affiliateSearch"
				class="field-input adminSearch auditFilter-search"
				type="search"
				placeholder="Search affiliates…"
				aria-label="Search affiliates"
			>

			<ul class="auditFilter-list">
				<li>
					<button
						type="button"
						class="auditFilter-option"
						:class="{ 'is-selected': affiliateId === null }"
						@click="filterBy(null)"
					>
						Everything
					</button>
				</li>
				<li v-for="affiliate in matchingAffiliates" :key="affiliate.id">
					<button
						type="button"
						class="auditFilter-option"
						:class="{ 'is-selected': affiliateId === affiliate.id }"
						@click="filterBy(affiliate.id)"
					>
						{{ affiliate.displayName }}
						<span class="auditFilter-slug">?r={{ affiliate.slug }}</span>
						<span v-if="affiliate.status !== 'active'" class="auditFilter-revoked">Revoked</span>
					</button>
				</li>
				<li v-if="!matchingAffiliates.length" class="dashPanel-note">
					No affiliate matches that.
				</li>
			</ul>
		</section>

		<section class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">
					{{ selected ? `What happened to ${selected.displayName}` : "Everything, newest first" }}
				</h2>
			</div>

			<p v-if="loading" class="dashPanel-note">Loading…</p>
			<p v-else-if="!entries.length" class="dashPanel-empty">Nothing recorded yet.</p>

			<ol v-else class="auditLog">
				<li v-for="entry in described" :key="entry.id" class="auditLog-row">
					<span class="auditLog-dot" :class="`is-${entry.tone}`" aria-hidden="true" />

					<span class="auditLog-body">
						<span class="auditLog-text">{{ entry.text }}</span>
						<span class="auditLog-meta">
							<!-- Only when unfiltered: with one affiliate selected, saying
							     whose row it is on every line is noise. -->
							<template v-if="!selected && entry.affiliateSlug">
								?r={{ entry.affiliateSlug }} ·
							</template>
							{{ actorLabel(entry.actorKind) }} · {{ formatWhen(entry.at) }}
							<template v-if="entry.ip"> · {{ entry.ip }}</template>
						</span>
					</span>
				</li>
			</ol>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAudit, describeAudit } from "~/assets/js/components/audit";

definePageMeta({
	layout: "dashboard",
	middleware: "admin",
});

useSeoMeta({
	title: "Activity",
	robots: "noindex, nofollow",
});

const {
	entries, loading, error,
	affiliateId, affiliateSearch, matchingAffiliates, selected,
	load, loadAffiliates, filterBy,
} = useAudit();

await Promise.all([load(), loadAffiliates()]);

// Described once here rather than in the template, where the tone and the text
// are two reads and would have run the switch twice for every row.
const described = computed(() => entries.value.map(entry => ({
	...entry,
	...describeAudit(entry),
})));

/** Who did it. "system" covers webhooks and anything with no signed-in actor. */
const actorLabel = (kind: string) =>
	kind === "admin" ? "by an admin" : kind === "affiliate" ? "by them" : "automatic";

/** Date and time both: two entries a minute apart is often the whole story. */
const formatWhen = (iso: string) =>
	new Date(iso).toLocaleString("en-GB", {
		day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
	});
</script>
