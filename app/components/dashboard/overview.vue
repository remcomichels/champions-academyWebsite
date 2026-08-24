<template>
	<div class="dash">
		<!-- ── Hero ──────────────────────────────────────────────────────── -->
		<header class="dashHero">
			<div class="dashHero-copy">
				<p class="dashHero-eyebrow">Affiliate dashboard</p>
				<p class="dashHero-title">Welcome back, {{ firstName }}</p>
				<p class="dashHero-sub">Share your link, and everyone who arrives through it is credited to you for 30 days.</p>

				<div class="dashHero-actions">
					<NuxtDashboardCopyField :value="summary.referralUrl" @copied="onCopied" />

					<a
						v-if="summary.links.vip"
						class="btn btn--ghost"
						:href="summary.links.vip"
						target="_blank"
						rel="noopener noreferrer"
					>
						<NuxtDashboardIcon name="external" />
						VIP link
					</a>
				</div>
			</div>

			<div class="dashHero-qr">
				<!-- eslint-disable-next-line vue/html-self-closing -->
				<img
					class="dashHero-qrImage"
					:src="qrSrc"
					alt="QR code for your referral link"
					width="140"
					height="140"
				>
				<span class="dashHero-qrNote">Scan to open</span>
			</div>
		</header>

		<!-- Owner-side problem, not an affiliate task: their VIP buttons are
		     quietly falling back to the site default until this is set up. -->
		<NuxtAlertBanner v-if="summary.vipLinkPending" variant="warning">
			Your VIP link is still being set up. Until it's ready, VIP buttons on the
			site show the standard link and those sales won't be credited to you.
		</NuxtAlertBanner>

		<!-- ── Figures ───────────────────────────────────────────────────── -->
		<div class="statGrid">
			<NuxtDashboardStatCard label="Today" :value="summary.visits.today" icon="home" accent />
			<NuxtDashboardStatCard label="Last 30 days" :value="summary.visits.last30d" icon="chart" />
			<NuxtDashboardStatCard label="All time" :value="summary.visits.total" icon="tag" />
		</div>

		<!-- ── Chart + side panel ────────────────────────────────────────── -->
		<div class="dashGrid">
			<section class="dashPanel dashGrid-main">
				<div class="dashPanel-head">
					<h2 class="dashPanel-title">Link visits</h2>
					<div class="rangeTabs">
						<button
							v-for="option in ranges"
							:key="option.days"
							type="button"
							class="rangeTabs-tab"
							:class="{ 'is-active': rangeDays === option.days }"
							@click="rangeDays = option.days"
						>
							{{ option.label }}
						</button>
					</div>
				</div>

				<NuxtDashboardBarChart :points="series" unit="visits" />

				<p class="dashPanel-note">
					Counted once per person per day, on our own server — so refreshing your
					own link won't inflate it and ad blockers can't hide anyone.
				</p>
			</section>

			<!-- Swaps to a link summary once setup is done, rather than leaving a
			     hole in the grid where the checklist used to be. -->
			<section v-if="!onboardingComplete" class="dashPanel dashGrid-side">
				<div class="dashPanel-head">
					<h2 class="dashPanel-title">Getting set up</h2>
					<span class="dashPanel-count">{{ summary.onboarding.completed }} of {{ summary.onboarding.total }}</span>
				</div>

				<div
					class="progress"
					role="progressbar"
					:aria-valuenow="summary.onboarding.completed"
					aria-valuemin="0"
					:aria-valuemax="summary.onboarding.total"
				>
					<div class="progress-fill" :style="{ transform: `scaleX(${progress})` }" />
				</div>

				<ul class="checklist">
					<li v-for="step in steps" :key="step.key" class="checklist-item" :class="{ 'is-done': step.done }">
						<span class="checklist-mark" aria-hidden="true">
							<NuxtDashboardIcon v-if="step.done" name="check" />
						</span>
						<span class="checklist-text">
							{{ step.label }}
							<span class="sr-only">{{ step.done ? "(done)" : "(not done)" }}</span>
						</span>
					</li>
				</ul>

				<NuxtLink to="/dashboard/links" class="dashPanel-cta">Finish setup</NuxtLink>
			</section>

			<section v-else class="dashPanel dashGrid-side">
				<h2 class="dashPanel-title">Where your buttons point</h2>

				<ul class="linkStatus">
					<li v-for="row in linkRows" :key="row.label" class="linkStatus-row">
						<span class="linkStatus-label">{{ row.label }}</span>
						<span class="linkStatus-state" :class="row.set ? 'is-set' : 'is-unset'">
							{{ row.set ? "Yours" : "Site default" }}
						</span>
					</li>
				</ul>

				<NuxtLink to="/dashboard/links" class="dashPanel-cta">Manage links</NuxtLink>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { AffiliateSummary } from "~/composables/useAffiliateSummary";

const props = defineProps<{ summary: AffiliateSummary }>();
const emit = defineEmits<{ refresh: [] }>();

/** Bound rather than a literal src, or Rollup treats it as a build asset. */
const qrSrc = "/api/affiliate/qr";

// Just the first word: "Welcome back, Remco Michels" reads like a form letter.
const firstName = computed(() => props.summary.affiliate.displayName.split(" ")[0] ?? "there");

const ranges = [
	{ days: 7, label: "7d" },
	{ days: 14, label: "14d" },
	{ days: 30, label: "30d" },
] as const;

const rangeDays = ref<number>(14);

/**
 * The API only returns days that actually had a visit, so the raw array has to
 * be zero-filled before it can be plotted — otherwise a quiet week closes up
 * and three scattered visits render as three consecutive busy days.
 *
 * Built in UTC to match the `day` column, which is written server-side as a
 * UTC date. Deriving it from local time would shift every bar by one day for
 * anyone west of Greenwich.
 */
const series = computed(() => {
	const counts = new Map(props.summary.visits.byDay.map(row => [row.day, row.count]));
	const out: { label: string; value: number }[] = [];

	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	for (let i = rangeDays.value - 1; i >= 0; i--) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() - i);

		const key = date.toISOString().slice(0, 10);
		out.push({
			label: date.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" }),
			value: counts.get(key) ?? 0,
		});
	}

	return out;
});

const steps = computed(() => [
	{ key: "lite", label: "Add your Telegram link", done: props.summary.onboarding.steps.liteTelegramAdded },
	{ key: "calendly", label: "Add your Calendly link", done: props.summary.onboarding.steps.calendlyAdded },
	{ key: "shared", label: "Copy your referral link", done: props.summary.onboarding.steps.linkShared },
	{ key: "visit", label: "Get your first link visit", done: props.summary.onboarding.steps.firstVisitReceived },
]);

const onboardingComplete = computed(() =>
	props.summary.onboarding.completed >= props.summary.onboarding.total);

const progress = computed(() =>
	props.summary.onboarding.total === 0
		? 0
		: props.summary.onboarding.completed / props.summary.onboarding.total);

const linkRows = computed(() => [
	{ label: "VIP checkout", set: Boolean(props.summary.links.vip) },
	{ label: "Telegram (Lite)", set: Boolean(props.summary.links.lite) },
	{ label: "Calendly", set: Boolean(props.summary.links.calendly) },
]);

async function onCopied() {
	// Fire and forget: the copy already worked, and failing to record the
	// onboarding step is not worth an error message.
	try {
		await $fetch("/api/affiliate/link-shared", { method: "POST" });
		emit("refresh");
	}
	catch {
		// Ignored on purpose.
	}
}
</script>
