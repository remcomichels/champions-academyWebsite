<template>
	<section class="section changelogPage">
		<div class="container">
			<!-- One measure for the whole page, matching the Preferences column
			     in the dashboard. A changelog is read line by line, so the cap
			     is a reading measure rather than a layout choice — see the note
			     on `.changelogPage-inner`. -->
			<div class="changelogPage-inner">
				<header class="changelogPage-head">
					<h1 class="changelogPage-title">Changelog</h1>
					<p class="changelogPage-text">New updates and product improvements</p>
				</header>

				<p v-if="error" class="changelogPage-note">
					The changelog didn't load. Try again in a moment.
				</p>

				<p v-else-if="pending" class="changelogPage-note">Loading…</p>

				<p v-else-if="!entries.length" class="changelogPage-note">
					Nothing here yet. Updates to the platform will show up on this page.
				</p>

				<!-- The line down the left is drawn on the list, not on each
				     entry: it has to run *between* entries as well as beside
				     them, and a per-entry border would break at every gap. -->
				<ol v-else class="timeline">
					<li v-for="entry in entries" :key="entry.id" class="timeline-entry">
						<div class="timeline-meta">
							<h2 class="timeline-title">{{ entry.title }}</h2>
							<p class="timeline-when">
								<time :datetime="entry.at">{{ formatDate(entry.at) }}</time>
							</p>
							<span class="timeline-pill" :class="`is-${entry.kind}`">
								{{ CHANGELOG_LABELS[entry.kind] }}
							</span>
						</div>

						<div class="timeline-copy">
							<p class="timeline-body">{{ entry.body }}</p>
						</div>
					</li>
				</ol>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
/**
 * The public changelog.
 *
 * A page on the website rather than a tab in the dashboard: release notes are
 * for anyone deciding whether the product is looked after, not only for people
 * already signed in. It uses the site's own header and footer through the
 * default layout, so nothing about it reads as an app surface.
 *
 * Not indexed, by choice — see the `robots` tag below and the matching
 * `x-robots-tag` route rule.
 */
import type { ChangelogEntry } from "#shared/types/changelog";
import { CHANGELOG_LABELS } from "#shared/types/changelog";

useSeoMeta({
	title: "Changelog",
	description: "New updates and product improvements.",
	// Public but deliberately unlisted: readable by anyone with the link,
	// and not a page we want turning up as a search result for the brand.
	robots: "noindex, nofollow",
});

const { data, pending, error } = await useAsyncData<{ entries: ChangelogEntry[] }>(
	"changelog",
	// No cookie forwarding: the endpoint is public now, so there is no session
	// for it to read and nothing here varies by visitor. That is also what
	// lets this page sit in the CDN cache with every other marketing page.
	() => $fetch<{ entries: ChangelogEntry[] }>("/api/changelog"),
);

const entries = computed(() => data.value?.entries ?? []);

// "Aug 28, 2026". en-US rather than the site's en-GB elsewhere because this is
// the abbreviated month-first form, which en-GB renders as "28 Aug 2026".
const formatDate = (value: string) =>
	new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
</script>
