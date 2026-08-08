<template>
	<div class="dashSection">
		<!-- Owner-side problem, not an affiliate task: their VIP buttons are
		     quietly falling back to the site default until this is set up. -->
		<NuxtAlertBanner v-if="summary.vipLinkPending" variant="warning">
			Your VIP link is still being set up. Until it's ready, VIP buttons on the
			site show the standard link and those sales won't be credited to you.
		</NuxtAlertBanner>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Your link</h2>
			<p class="dashPanel-note">Share this anywhere. Everyone who arrives through it is credited to you for 30 days.</p>
			<NuxtDashboardCopyField :value="summary.referralUrl" @copied="onCopied" />
		</section>

		<section v-if="!onboardingComplete" class="dashPanel">
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
					<span class="checklist-mark" aria-hidden="true">{{ step.done ? "✓" : "" }}</span>
					<span class="checklist-text">
						{{ step.label }}
						<span class="sr-only">{{ step.done ? "(done)" : "(not done)" }}</span>
					</span>
				</li>
			</ul>
		</section>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Link visits</h2>
			<div class="statGrid">
				<NuxtDashboardStatCard label="Today" :value="summary.visits.today" />
				<NuxtDashboardStatCard label="Last 30 days" :value="summary.visits.last30d" />
				<NuxtDashboardStatCard label="All time" :value="summary.visits.total" />
			</div>
			<p class="dashPanel-note">
				Everyone who opened your link, counted once per person per day — so
				refreshing it yourself won't inflate the number. Counted on our own
				server, which means ad blockers can't hide anyone, and these totals are
				never trimmed. This is your number.
			</p>
		</section>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Recent activity</h2>
			<ul v-if="recentDays.length" class="activity">
				<li v-for="row in recentDays" :key="row.day" class="activity-row">
					<span class="activity-day">{{ formatDay(row.day) }}</span>
					<span class="activity-count">{{ row.count }} {{ row.count === 1 ? "visit" : "visits" }}</span>
				</li>
			</ul>
			<p v-else class="dashPanel-empty">
				No visits yet. Once someone opens your link, they'll show up here.
			</p>
		</section>
	</div>
</template>

<script setup lang="ts">
import type { AffiliateSummary } from "~/composables/useAffiliateSummary";

const props = defineProps<{ summary: AffiliateSummary }>();
const emit = defineEmits<{ refresh: [] }>();

const steps = computed(() => [
	{ key: "lite", label: "Add your Telegram link", done: props.summary.onboarding.steps.liteTelegramAdded },
	{ key: "calendly", label: "Add your Calendly link", done: props.summary.onboarding.steps.calendlyAdded },
	{ key: "shared", label: "Copy your referral link", done: props.summary.onboarding.steps.linkShared },
	{ key: "visit", label: "Get your first link visit", done: props.summary.onboarding.steps.firstVisitReceived },
]);

const onboardingComplete = computed(() =>
	props.summary.onboarding.completed >= props.summary.onboarding.total,
);

const progress = computed(() =>
	props.summary.onboarding.total === 0
		? 0
		: props.summary.onboarding.completed / props.summary.onboarding.total,
);

const recentDays = computed(() => [...props.summary.visits.byDay].reverse().slice(0, 7));

const formatDay = (day: string) =>
	new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
		weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
	});

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
