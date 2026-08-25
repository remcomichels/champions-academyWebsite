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

		<!-- ── Getting set up ────────────────────────────────────────────── -->
		<!-- Directly under the notice rather than in the grid below. It is a
		     temporary strip, not a permanent panel: it is the first thing to read
		     while there is anything left to do, and once all four steps are done
		     it disappears for good instead of leaving a card behind. -->
		<section v-if="!onboardingComplete" class="dashSetup">
			<div class="dashSetup-head">
				<h2 class="dashSetup-title">Getting set up</h2>
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

			<ul class="checklist checklist--row">
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

			<NuxtLink to="/dashboard/links" class="dashSetup-cta">Finish setup</NuxtLink>
		</section>

		<!-- ── Figures ───────────────────────────────────────────────────── -->
		<div class="statGrid">
			<NuxtDashboardStatCard
				label="Today"
				:value="summary.visits.today"
				icon="home"
				accent
				:trend="todayTrend"
			/>
			<NuxtDashboardStatCard
				label="Last 30 days"
				:value="summary.visits.last30d"
				icon="chart"
				:trend="monthTrend"
			/>
			<NuxtDashboardStatCard
				label="All time"
				:value="summary.visits.total"
				icon="tag"
				:hint="allTimeHint"
			/>
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

				<NuxtDashboardBarChart :points="series" unit="visits" unit-one="visit" />

				<p class="dashPanel-note">
					Counted once per person per day, on our own server — so refreshing your
					own link won't inflate it and ad blockers can't hide anyone.
				</p>
			</section>

			<!-- The four figures worth knowing at a glance, in the slot the setup
			     checklist used to occupy. Deliberately not wrapped in a panel:
			     four cards inside a fifth card is a box that earns nothing, so
			     they sit on the page as peers of the chart beside them. -->
			<section class="dashGrid-side dashSide">
				<!-- Kept for the heading outline a screen reader navigates by.
				     Sighted readers get the same from the four labels, which is
				     why there is no visible title to go with them. -->
				<h2 class="sr-only">What's working</h2>

				<div class="miniGrid">
					<div v-for="card in highlights" :key="card.label" class="miniCard">
						<p class="miniCard-label">{{ card.label }}</p>

						<p class="miniCard-value" :class="{ 'is-empty': !card.note }">
							<span
								v-if="card.flag"
								class="miniCard-flag"
								aria-hidden="true"
							>{{ card.flag }}</span>{{ card.value }}
						</p>

						<!-- One mark per card, and only where there is something
						     behind it: a card with no figure shows its em dash
						     alone rather than an empty plot, which would read as
						     a chart that failed to load. -->
						<div v-if="card.note" class="miniCard-plot">
							<NuxtDashboardSparkbars
								v-if="card.bars"
								:points="card.bars"
								:peak="card.peak ?? null"
							/>

							<span v-else-if="card.share !== null" class="miniCard-meter" aria-hidden="true">
								<span
									class="miniCard-meterFill"
									:style="{ transform: `scaleX(${card.share ?? 0})` }"
								/>
							</span>
						</div>

						<p v-if="card.note" class="miniCard-note">{{ card.note }}</p>
					</div>
				</div>

				<p class="dashSide-note">
					Hours are in {{ summary.highlights.timezone }}
					<span class="dashPanel-count">last {{ summary.highlights.days }} days</span>
				</p>
			</section>
		</div>

		<!-- Kept out of the grid above, which the summary now fills. Only once
		     setup is done, exactly as before — mid-setup the checklist at the top
		     is already saying this. -->
		<section v-if="onboardingComplete" class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">Where your buttons point</h2>
				<NuxtLink to="/dashboard/links" class="dashPanel-cta dashPanel-cta--inline">Manage links</NuxtLink>
			</div>

			<ul class="linkStatus linkStatus--row">
				<li v-for="row in linkRows" :key="row.label" class="linkStatus-row">
					<span class="linkStatus-label">{{ row.label }}</span>
					<span class="linkStatus-state" :class="row.set ? 'is-set' : 'is-unset'">
						{{ row.set ? "Yours" : "Site default" }}
					</span>
				</li>
			</ul>
		</section>
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
	const out: { label: string; title: string; value: number }[] = [];

	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	for (let i = rangeDays.value - 1; i >= 0; i--) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() - i);

		const key = date.toISOString().slice(0, 10);
		out.push({
			label: date.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" }),
			// Same reason as the Sales chart: the axis is thinned, so the hover
			// readout is the only thing that names most of these days.
			title: date.toLocaleDateString("en-GB", {
				weekday: "short",
				day: "numeric",
				month: "short",
				timeZone: "UTC",
			}),
			value: counts.get(key) ?? 0,
		});
	}

	return out;
});

const todayTrend = computed(() =>
	trend(props.summary.visits.today, props.summary.visits.yesterday, "vs yesterday"));

const monthTrend = computed(() =>
	trend(props.summary.visits.last30d, props.summary.visits.previous30d, "vs last month"));

/**
 * All-time gets a plain count, not a percentage.
 *
 * A cumulative total can only ever go up, so "change versus the previous
 * all-time" is not a real quantity — any arrow next to it would be invented.
 * What is genuinely useful is how much of that total is recent.
 */
const allTimeHint = computed(() => {
	const recent = props.summary.visits.last30d;
	if (!props.summary.visits.total) return null;
	return `${recent.toLocaleString("en-GB")} in the last 30 days`;
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

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const visitCount = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "visit" : "visits"}`;

interface HighlightCard {
	label: string;
	value: string;
	note: string | null;
	/** The distribution the figure came out of, for the cards that have one. */
	bars?: { label: string; value: number }[];
	/** Index within `bars` to accent — the slot the value names. */
	peak?: number | null;
	/** 0–1 share of all visits, for the cards that are a proportion. */
	share?: number | null;
	flag?: string | null;
}

/**
 * ISO 3166-1 alpha-2 to a flag, via the regional-indicator block.
 *
 * Windows ships no glyph for these pairs and draws the two letters instead, so
 * a Dutch flag becomes "NL". That is a fine outcome and the reason the country
 * name still sits beside it — the flag is a second read of something already
 * written, never the only one.
 */
const flagOf = (code: string) => {
	if (!/^[a-z]{2}$/i.test(code)) return null;

	return String.fromCodePoint(
		...[...code.toUpperCase()].map(letter => 0x1F1E6 + letter.charCodeAt(0) - 65),
	);
};

/**
 * The four summary cards.
 *
 * A missing figure shows an em dash with no supporting line, rather than a
 * zero: "Best day — 0 visits" reads as a measurement, when the truth is that
 * there is nothing to measure yet.
 *
 * Each card carries one proportional mark under its value: the day and hour
 * cards plot the distribution their peak came out of, and the source and
 * country cards show what fraction of all visits they account for. A peak with
 * no shape behind it is an assertion — six quiet days and one busy Saturday
 * and a week of even traffic both produce "Saturday", and they mean opposite
 * things.
 */
const highlights = computed<HighlightCard[]>(() => {
	const h = props.summary.highlights;

	/**
	 * "412 visits · 38% of all".
	 *
	 * Anything under half a percent is left off rather than rounded, because
	 * "0% of all" beside a row that demonstrably has traffic reads as none.
	 * Same reasoning as the null in shared/utils/trend.ts.
	 */
	const shareNote = (visits: number) => {
		const fraction = h.total > 0 ? visits / h.total : 0;
		return fraction >= 0.005
			? `${visitCount(visits)} · ${Math.round(fraction * 100)}% of all`
			: visitCount(visits);
	};

	/**
	 * Floored at 2%, matching the sliver NuxtDashboardBreakdown leaves on its
	 * smallest row. Under that the fill renders as a nub against the track and
	 * reads as a rendering fault rather than a small number — and the exact
	 * figure is not what this mark is for. The note beside it carries the
	 * count, and drops the percentage entirely below half a percent.
	 */
	const shareOf = (visits: number) =>
		(h.total > 0 ? Math.max(visits / h.total, 0.02) : null);

	// A three-hour band, because "21:00" implies a precision an hourly bucket
	// does not have — the visits in that bucket are spread across the hour.
	const hourBand = (hour: number) => {
		const pad = (n: number) => String((n + 24) % 24).padStart(2, "0");
		return `${pad(hour)}:00–${pad(hour + 1)}:00`;
	};

	// Vercel sends ISO codes; an unrecognised one must not throw.
	const countryName = (code: string) => {
		try {
			return regionNames.of(code) ?? code;
		}
		catch {
			return code;
		}
	};

	return [
		{
			label: "Best day",
			value: h.bestDay ? DAY_NAMES[h.bestDay.dow - 1] ?? "—" : "—",
			note: h.bestDay ? visitCount(h.bestDay.visits) : null,
			// Full day names in the readout, short ones would need a second
			// lookup table for no gain — the tip has room for "Wednesday".
			bars: h.dowTotals.map((value, index) => ({
				label: DAY_NAMES[index] ?? "",
				value,
			})),
			// dow is the ISO weekday, 1 = Monday, and the array is Monday-first.
			peak: h.bestDay ? h.bestDay.dow - 1 : null,
		},
		{
			label: "Best hour",
			value: h.bestHour ? hourBand(h.bestHour.hour) : "—",
			note: h.bestHour ? visitCount(h.bestHour.visits) : null,
			bars: h.hourTotals.map((value, hour) => ({ label: hourBand(hour), value })),
			peak: h.bestHour ? h.bestHour.hour : null,
		},
		{
			// A null referrer host is direct traffic — DMs, stories and QR scans
			// all land there — not an unknown one.
			label: "Top source",
			value: h.topSource ? h.topSource.host ?? "Direct" : "—",
			note: h.topSource ? shareNote(h.topSource.visits) : null,
			share: h.topSource ? shareOf(h.topSource.visits) : null,
		},
		{
			label: "Top country",
			value: h.topCountry ? countryName(h.topCountry.country) : "—",
			note: h.topCountry ? shareNote(h.topCountry.visits) : null,
			share: h.topCountry ? shareOf(h.topCountry.visits) : null,
			flag: h.topCountry ? flagOf(h.topCountry.country) : null,
		},
	];
});

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
