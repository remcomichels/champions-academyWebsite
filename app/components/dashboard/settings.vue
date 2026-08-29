<template>
	<!-- One centred column, in source order. Nothing is reordered to make the
	     heights line up: these panels are read top to bottom the first time
	     somebody opens the page, and pairing them by height would shuffle that
	     for a tidier bottom edge, which is the wrong trade. -->
	<div v-if="data" class="dashSettings">
		<NuxtAlertBanner v-if="banner" :variant="banner.variant">
			{{ banner.text }}
		</NuxtAlertBanner>

		<!-- Preferences ─────────────────────────────────────────────────── -->
		<section v-if="isPreferences" class="dashPanel">
			<h2 class="dashPanel-title">Profile</h2>
			<form class="dashForm" novalidate @submit.prevent="saveProfile">
				<NuxtAuthField v-model="profile.displayName" label="Name" :error="errors.displayName" required />

				<div class="readonlyField">
					<span class="field-label">Email</span>
					<code class="readonlyField-value">{{ data.profile.email ?? "—" }}</code>
					<p class="field-message">Message us to change this — we can't verify a new address automatically yet.</p>
				</div>

				<NuxtDashboardTimezoneField
					v-model="profile.timezone"
					label="Timezone"
					:error="errors.timezone"
					hint="Used for dates and times on your dashboard."
				/>

				<button type="submit" class="btn btn--primary dashForm-submit" :disabled="busy === 'profile'">
					{{ busy === "profile" ? "Saving…" : "Save profile" }}
				</button>
			</form>
		</section>

		<section v-if="isPreferences" class="dashPanel">
			<h2 class="dashPanel-title">Your link</h2>
			<p class="dashPanel-note">
				Changing this changes your <code>?r=</code> link. Your old one keeps working
				for 90 days, so anything already printed or posted stays live — but you can
				only change it once every {{ data.slugChange.cooldownDays }} days.
			</p>

			<NuxtAlertBanner v-if="data.slugChange.nextAllowedAt" variant="info">
				You can change this again on {{ formatDate(data.slugChange.nextAllowedAt) }}.
			</NuxtAlertBanner>

			<form v-else class="dashForm" novalidate @submit.prevent="saveSlug">
				<NuxtAuthField v-model="slug" label="Link" :error="errors.slug" hint="Lowercase letters, numbers and dashes." />
				<button type="submit" class="btn btn--primary dashForm-submit" :disabled="busy === 'slug'">
					{{ busy === "slug" ? "Changing…" : "Change link" }}
				</button>
			</form>
		</section>

		<!-- Your data sits with Preferences rather than Security. Exporting or
		     deleting your own account is not a defence against anybody — it is
		     the last thing you are free to decide about it, which is what the
		     rest of this tab is. -->
		<section v-if="isPreferences" class="dashPanel">
			<h2 class="dashPanel-title">Your data</h2>
			<p class="dashPanel-note">
				Download everything we hold about you, or ask us to delete the account.
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
		</section>

		<!-- Security ────────────────────────────────────────────────────── -->
		<section v-if="isSecurity" class="dashPanel">
			<h2 class="dashPanel-title">Password</h2>
			<form class="dashForm" novalidate @submit.prevent="savePassword">
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
			<p class="dashPanel-note">Changing your password signs you out everywhere else.</p>
		</section>

		<section v-if="isSecurity" class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">Where you're signed in</h2>
				<button
					v-if="data.sessions.length > 1"
					type="button"
					class="dashPanel-cta"
					:disabled="busy === 'sessions'"
					@click="signOutOthers"
				>Sign out everywhere else</button>
			</div>

			<ul class="sessionList">
				<li v-for="session in data.sessions" :key="session.id" class="sessionList-row">
					<span class="sessionList-device">
						{{ session.device }}
						<span v-if="session.current" class="sessionList-current">This device</span>
					</span>
					<span class="sessionList-meta">last used {{ formatWhen(session.lastSeenAt) }}</span>
				</li>
			</ul>
		</section>

		<!-- Logs ────────────────────────────────────────────────────────── -->
		<section v-if="isLogs" class="dashPanel">
			<h2 class="dashPanel-title">Audit log</h2>
			<p class="dashPanel-note">
				Everything recorded against your account, most recent first. Showing the
				last {{ data.recentActivity.length }}.
			</p>
			<ul v-if="data.recentActivity.length" class="activity">
				<li v-for="(row, i) in data.recentActivity" :key="i" class="activity-row">
					<span class="activity-day">{{ describeAction(row.action) }}</span>
					<span class="activity-count">{{ formatWhen(row.at) }}</span>
				</li>
			</ul>
			<p v-else class="dashPanel-empty">Nothing recorded yet.</p>
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

const {
	data, banner, busy, errors,
	profile, slug, passwords, pendingDelete,
	saveProfile, saveSlug, savePassword,
	signOutOthers, gdpr, confirmDelete, exportData,
	formatDate, formatWhen, describeAction,
} = await useSettings();
</script>
