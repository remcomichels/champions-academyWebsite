<template>
	<!-- One centred column, in source order. Nothing is reordered to make the
	     heights line up: these blocks are read top to bottom the first time
	     somebody opens the page, and pairing them by height would shuffle that
	     for a tidier bottom edge, which is the wrong trade. -->
	<div v-if="data" class="dashSettings">
		<header class="settingsHead">
			<h1 class="settingsHead-title">{{ page.title }}</h1>
			<p class="settingsHead-text">{{ page.text }}</p>
		</header>

		<NuxtAlertBanner v-if="banner" :variant="banner.variant">
			{{ banner.text }}
		</NuxtAlertBanner>

		<!-- Preferences ─────────────────────────────────────────────────── -->
		<section v-if="isPreferences" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Profile information</h2>
				<p class="settingsBlock-text">The name we show on your dashboard, and the address we reach you at.</p>
			</header>

			<div class="dashPanel">
				<form class="dashForm dashForm--split" novalidate @submit.prevent="saveProfile">
					<NuxtAuthField
						v-model="profile.firstName"
						label="First name"
						placeholder="First name"
						:error="errors.firstName"
						required
					/>
					<NuxtAuthField
						v-model="profile.lastName"
						label="Last name"
						placeholder="Last name"
						:error="errors.lastName"
					/>

					<!-- A select with one option today, because one address is all
					     an account has. It is the right control for what this is
					     rather than for what it currently holds: the moment a
					     second address exists it needs no rebuilding, and picking
					     which of several is primary is the only interaction this
					     row will ever want. -->
					<div class="field">
						<label class="field-label" for="primary-email">Primary email</label>
						<p class="field-message">Used for account notifications.</p>

						<div class="field-control">
							<select id="primary-email" class="field-input field-input--select">
								<option>{{ data.profile.email ?? "—" }}</option>
							</select>
							<NuxtDashboardIcon name="chevronDown" class="field-caret" />
						</div>
					</div>

					<!-- Read-only here on purpose. This is the `?r=` handle, and
					     changing it is rate-limited with a grace period on the old
					     one — not something that belongs among plain text fields
					     where one Save covers everything. Its own card, below,
					     says what changing it costs. -->
					<div class="readonlyField">
						<span class="field-label">Username</span>
						<code class="readonlyField-value">{{ data.profile.slug }}</code>
						<p class="field-message">Your public handle. Change it under Your link, below.</p>
					</div>

					<button type="submit" class="btn btn--primary dashForm-submit" :disabled="busy === 'profile'">
						{{ busy === "profile" ? "Saving…" : "Save profile" }}
					</button>
				</form>
			</div>
		</section>

		<section v-if="isPreferences" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Your link</h2>
				<p class="settingsBlock-text">The handle that credits a referral to you.</p>
			</header>

			<div class="dashPanel">
				<p class="dashPanel-note">
					Changing this changes your <code>?r=</code> link. Your old one keeps working
					for 90 days, so anything already printed or posted stays live — but you can
					only change it once every {{ data.slugChange.cooldownDays }} days.
				</p>

				<NuxtAlertBanner v-if="data.slugChange.nextAllowedAt" variant="info">
					You can change this again on {{ formatDate(data.slugChange.nextAllowedAt) }}.
				</NuxtAlertBanner>

				<form v-else class="dashForm dashForm--split" novalidate @submit.prevent="saveSlug">
					<NuxtAuthField v-model="slug" label="Link" :error="errors.slug" hint="Lowercase letters, numbers and dashes." />
					<button type="submit" class="btn btn--primary dashForm-submit" :disabled="busy === 'slug'">
						{{ busy === "slug" ? "Changing…" : "Change link" }}
					</button>
				</form>
			</div>
		</section>

		<!-- Your data sits with Preferences rather than Security. Exporting or
		     deleting your own account is not a defence against anybody — it is
		     the last thing you are free to decide about it, which is what the
		     rest of this tab is. -->
		<section v-if="isPreferences" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Your data</h2>
				<p class="settingsBlock-text">Take a copy of everything we hold, or ask us to remove it.</p>
			</header>

			<div class="dashPanel">
				<p class="dashPanel-note">
					Deletion waits 14 days before anything is removed, so it can be undone.
				</p>

				<NuxtAlertBanner v-if="pendingDelete" variant="warning">
					Deletion requested — scheduled for {{ formatDate(pendingDelete.executeAfter) }}.
					<button type="button" class="linkButton" @click="gdpr('cancel')">Cancel it</button>
				</NuxtAlertBanner>

				<div class="dangerRow">
					<button type="button" class="linkButton" :disabled="busy === 'gdpr'" @click="exportData">
						Download my data
					</button>
					<button
						v-if="!pendingDelete"
						type="button"
						class="linkButton is-danger"
						:disabled="busy === 'gdpr'"
						@click="confirmDelete"
					>Delete my account</button>
				</div>
			</div>
		</section>

		<!-- Security ────────────────────────────────────────────────────── -->
		<section v-if="isSecurity" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Password</h2>
				<p class="settingsBlock-text">Used with your email to sign in. Changing it signs you out everywhere else.</p>
			</header>

			<div class="dashPanel">
				<form class="dashForm dashForm--split" novalidate @submit.prevent="savePassword">
					<NuxtAuthField
						v-model="passwords.currentPassword"
						label="Current password"
						type="password"
						autocomplete="current-password"
						:error="errors.currentPassword"
					/>
					<NuxtAuthField
						v-model="passwords.newPassword"
						label="New password"
						type="password"
						autocomplete="new-password"
						:error="errors.newPassword"
						hint="At least 12 characters."
					/>
					<NuxtAuthField
						v-model="passwords.newPasswordConfirm"
						label="Confirm new password"
						type="password"
						autocomplete="new-password"
						:error="errors.newPasswordConfirm"
					/>
					<button type="submit" class="btn btn--primary dashForm-submit" :disabled="busy === 'password'">
						{{ busy === "password" ? "Changing…" : "Change password" }}
					</button>
				</form>
			</div>
		</section>

		<section v-if="isSecurity" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Where you're signed in</h2>
				<p class="settingsBlock-text">Every session currently open on this account.</p>
			</header>

			<div class="dashPanel">
				<ul class="sessionList">
					<li v-for="session in data.sessions" :key="session.id" class="sessionList-row">
						<span class="sessionList-device">
							{{ session.device }}
							<span v-if="session.current" class="sessionList-current">This device</span>
						</span>
						<span class="sessionList-meta">last used {{ formatWhen(session.lastSeenAt) }}</span>
					</li>
				</ul>

				<button
					v-if="data.sessions.length > 1"
					type="button"
					class="dashPanel-cta"
					:disabled="busy === 'sessions'"
					@click="signOutOthers"
				>Sign out everywhere else</button>
			</div>
		</section>

		<!-- Logs ────────────────────────────────────────────────────────── -->
		<section v-if="isLogs" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Audit log</h2>
				<p class="settingsBlock-text">The most recent entries, newest first.</p>
			</header>

			<div class="dashPanel">
				<ul v-if="data.recentActivity.length" class="activity">
					<li v-for="(row, i) in data.recentActivity" :key="i" class="activity-row">
						<span class="activity-day">{{ describeAction(row.action) }}</span>
						<span class="activity-count">{{ formatWhen(row.at) }}</span>
					</li>
				</ul>
				<p v-else class="dashPanel-empty">Nothing recorded yet.</p>
			</div>
		</section>
	</div>

	<p v-else class="dash-loading">Loading…</p>
</template>

<script setup lang="ts">
import { useSettings } from "~/assets/js/components/settings";

/**
 * One component, three pages.
 *
 * Account and Settings were a single page until the profile menu split them,
 * and they are now one area again with three tabs. All three still render from
 * here rather than from three components, because every panel below shares one
 * fetch, one banner, one `busy` flag and one error bag — duplicating that
 * plumbing would be a great deal of surface for no gain, and three copies of
 * `useSettings()` would mean three requests and three independent notions of
 * what the account currently says.
 *
 * `preferences` is what you can freely change: your name, your link, and the
 * data requests that are yours to make. `security` is the pair of questions
 * asked when something looks wrong — your password, and who else is signed in.
 * `logs` is the record of what has already happened.
 */
const props = withDefaults(defineProps<{
	section?: "preferences" | "security" | "logs";
}>(), { section: "preferences" });

const isPreferences = computed(() => props.section === "preferences");
const isSecurity = computed(() => props.section === "security");
const isLogs = computed(() => props.section === "logs");

/**
 * The page's own heading, printed at the top of the column.
 *
 * Here rather than in the three page files because the heading and the blocks
 * under it are one piece of writing — the standfirst says what the tab covers
 * and each block heading names one part of it, and splitting the two apart is
 * how they drift into repeating each other.
 */
const HEADINGS = {
	preferences: {
		title: "Preferences",
		text: "Your name, the link people arrive on, and what happens to the data we hold about you.",
	},
	security: {
		title: "Security",
		text: "Your password, and every device currently signed in as you.",
	},
	logs: {
		title: "Audit Logs",
		text: "What has happened to this account, and when it happened.",
	},
} as const;

const page = computed(() => HEADINGS[props.section]);

const {
	data, banner, busy, errors,
	profile, slug, passwords, pendingDelete,
	saveProfile, saveSlug, savePassword,
	signOutOthers, gdpr, confirmDelete, exportData,
	formatDate, formatWhen, describeAction,
} = await useSettings();
</script>
