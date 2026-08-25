<template>
	<div v-if="data" class="dashSection">
		<NuxtAlertBanner v-if="banner" :variant="banner.variant">
			{{ banner.text }}
		</NuxtAlertBanner>

		<!-- Profile ─────────────────────────────────────────────────────── -->
		<section class="dashPanel">
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

		<!-- Your link ───────────────────────────────────────────────────── -->
		<section class="dashPanel">
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

		<!-- Notifications ───────────────────────────────────────────────── -->
		<section class="dashPanel">
			<h2 class="dashPanel-title">Notifications</h2>

			<label class="toggle">
				<input v-model="prefs.saleInApp" type="checkbox" @change="savePrefs">
				<span>Show me new sales in the dashboard</span>
			</label>

			<label class="toggle">
				<input v-model="prefs.saleEmail" type="checkbox" @change="savePrefs">
				<span>Email me about new sales</span>
			</label>

			<p class="dashPanel-note">
				Email isn't switched on yet — we'll honour this setting from the day it is,
				rather than opting you in automatically.
			</p>
		</section>

		<!-- Security ────────────────────────────────────────────────────── -->
		<section class="dashPanel">
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

		<section class="dashPanel">
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
						<span v-if="session.current" class="sessionList-current">this device</span>
					</span>
					<span class="sessionList-meta">last used {{ formatWhen(session.lastSeenAt) }}</span>
				</li>
			</ul>
		</section>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Recent account activity</h2>
			<ul v-if="data.recentActivity.length" class="activity">
				<li v-for="(row, i) in data.recentActivity" :key="i" class="activity-row">
					<span class="activity-day">{{ describeAction(row.action) }}</span>
					<span class="activity-count">{{ formatWhen(row.at) }}</span>
				</li>
			</ul>
			<p v-else class="dashPanel-empty">Nothing recorded yet.</p>
		</section>

		<!-- Privacy ─────────────────────────────────────────────────────── -->
		<section class="dashPanel">
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
	</div>

	<p v-else class="dash-loading">Loading…</p>
</template>

<script setup lang="ts">
import { useSettings } from "~/assets/js/components/settings";

const {
	data, banner, busy, errors,
	profile, slug, prefs, passwords, pendingDelete,
	saveProfile, saveSlug, savePrefs, savePassword,
	signOutOthers, gdpr, confirmDelete, exportData,
	formatDate, formatWhen, describeAction,
} = await useSettings();
</script>
