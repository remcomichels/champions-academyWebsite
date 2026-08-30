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

		<!-- Bottom right rather than above the cards. As a banner it pushed the
		     whole tab down the moment it appeared, and on a long page it
		     reported the result of a save that had scrolled out of view. The
		     two banners that remain are different things: they describe a
		     standing condition of the card they sit in, not an event. -->
		<NuxtDashboardToast :message="banner?.text ?? ''" :variant="banner?.variant ?? 'info'">
			{{ banner?.text }}
		</NuxtDashboardToast>

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

					<!-- One option today, because one address is all an account
					     has. It is the right control for what this row is rather
					     than for what it currently holds: the moment a second
					     address exists it needs no rebuilding, and picking which
					     of several is primary is the only interaction it will
					     ever want. -->
					<NuxtDashboardSelectField
						:model-value="data.profile.email ?? ''"
						:options="emailOptions"
						label="Primary email"
						hint="Used for account notifications."
					/>

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

					<!-- Cancel only exists while there is something to cancel.
					     A permanent one next to a disabled Save is two dead
					     controls where the form should be showing none. -->
					<div class="dashForm-actions">
						<button
							v-if="profileDirty"
							type="button"
							class="btn btn--ghost"
							:disabled="busy === 'profile'"
							@click="resetProfile"
						>Cancel</button>

						<button
							type="submit"
							class="btn btn--primary"
							:disabled="busy === 'profile' || !profileDirty"
						>
							{{ busy === "profile" ? "Saving…" : "Save profile" }}
						</button>
					</div>
				</form>
			</div>
		</section>

		<!-- Sign-in methods ─────────────────────────────────────────────── -->
		<!-- One row today, because one way in is all this account has. It is
		     built as a list rather than as a pair of fields for the same reason
		     the primary-email picker above is a picker: the day a second method
		     lands — a passkey, a Google sign-in — it is another row here and
		     nothing else on this page changes. -->
		<section v-if="isPreferences" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Sign-in methods</h2>
				<p class="settingsBlock-text">Manage the methods linked to your Champions Academy account and update their details.</p>
			</header>

			<div class="dashPanel">
				<div class="signinRow">
					<span class="signinRow-icon" aria-hidden="true">
						<NuxtDashboardIcon name="mail" />
					</span>

					<div class="signinRow-body">
						<span class="signinRow-label">Email</span>
						<span class="signinRow-value">{{ data.profile.email ?? "—" }}</span>
					</div>

					<div class="signinRow-actions">
						<!-- A link, not a button that navigates. It goes to a real
						     page, so it has to be middle-clickable and it has to
						     show its destination in the status bar. -->
						<NuxtLink to="/dashboard/account/password" class="btn btn--subtle">
							Change password
						</NuxtLink>

						<!-- `.tip` is decoration over the top of the aria-label,
						     never the only place the name exists. Centred rather
						     than `--end`: the balloon overhangs the panel edge a
						     little, which is what a tooltip does, and pinning it
						     right made it look like it belonged to the card
						     rather than to the control under it. -->
						<button
							type="button"
							class="iconButton tip"
							data-tip="Update email address"
							aria-label="Update email address"
							@click="openEmailDialog"
						>
							<NuxtDashboardIcon name="edit" />
						</button>
					</div>
				</div>

				<!-- Standing condition of this card, not an event — which is why
				     it is a banner in here rather than the toast the saves use.
				     Without it the page looks exactly as it did before the
				     request, which reads as "nothing happened" to somebody whose
				     mail is slow. -->
				<NuxtAlertBanner v-if="data.pendingEmailChange" variant="info">
					Waiting on <strong>{{ data.pendingEmailChange.email }}</strong> — open the link we sent
					there to finish the change. It expires {{ formatUntil(data.pendingEmailChange.expiresAt) }}.
					<button
						type="button"
						class="linkButton"
						:disabled="busy === 'email'"
						@click="cancelEmailChange"
					>Cancel it</button>
				</NuxtAlertBanner>
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
		<!-- The password form used to be the first thing on this tab. It moved
		     to /dashboard/account/password, reached from Sign-in methods under
		     Preferences, and is not duplicated back here: two places to change
		     one credential is two places to keep in step, and the one that
		     survived is the one the affiliate is sent to. -->
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

		<!-- Native <dialog>, not a div with a high z-index: showModal() gives
		     focus trapping, Escape, an inert background and top-layer stacking
		     that no sidebar or sticky bar can paint over. It stays mounted while
		     closed — there has to be an element to call showModal on. -->
		<dialog
			v-if="isPreferences"
			ref="emailDialog"
			class="modal modal--compact"
			@close="onEmailDialogClose"
			@click="onEmailDialogClick"
		>
			<form class="modal-panel" novalidate @submit.prevent="requestEmailChange">
				<header class="modal-head">
					<h2 class="modal-title">Update email address</h2>
					<button type="button" class="modal-close" aria-label="Close" @click="closeEmailDialog">
						<NuxtDashboardIcon name="close" />
					</button>
				</header>

				<div class="modal-body">
					<NuxtAlertBanner v-if="emailError" variant="error">
						{{ emailError }}
					</NuxtAlertBanner>

					<NuxtAuthField
						v-model="newEmail"
						label="Provide a new email address"
						type="email"
						inputmode="email"
						autocomplete="email"
						placeholder="example@email.com"
						:error="errors.email"
						:disabled="busy === 'email'"
						hint="A confirmation email will be sent to the provided email address"
						required
					/>
				</div>

				<footer class="modal-foot">
					<button type="button" class="btn btn--ghost" :disabled="busy === 'email'" @click="closeEmailDialog">
						Cancel
					</button>
					<button type="submit" class="btn btn--primary" :disabled="busy === 'email'">
						{{ busy === "email" ? "Sending…" : "Confirm" }}
					</button>
				</footer>
			</form>
		</dialog>
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
 * `preferences` is what you can freely change: your name, your link, how you
 * sign in, and the data requests that are yours to make. `security` is the
 * question asked when something looks wrong — who else is signed in. `logs` is
 * the record of what has already happened.
 *
 * Changing a password is deliberately not on `security`, even though that is
 * where it reads as though it belongs. It is one of two ways into this account
 * and the other is the email address, so the two are listed together under
 * Sign-in methods and both lead somewhere else to be changed.
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
		text: "Your name, how you sign in, the link people arrive on, and what happens to the data we hold about you.",
	},
	security: {
		title: "Security",
		text: "Every device currently signed in as you, and what to do when one of them isn't yours.",
	},
	logs: {
		title: "Audit Logs",
		text: "What has happened to this account, and when it happened.",
	},
} as const;

const page = computed(() => HEADINGS[props.section]);

/**
 * One entry, and it is the account's own address. A list rather than a bare
 * value because the control is a picker: when recovery addresses land, they
 * join this array and nothing else here changes.
 */
const emailOptions = computed(() => {
	const address = data.value?.profile.email;
	return address ? [{ value: address, label: address }] : [];
});

const emailDialog = useTemplateRef<HTMLDialogElement>("emailDialog");

const {
	data, banner, busy, errors,
	profile, slug, pendingDelete,
	profileDirty, resetProfile,
	saveProfile, saveSlug,
	signOutOthers, gdpr, confirmDelete, exportData,
	emailDialogOpen, newEmail, emailError,
	openEmailDialog, closeEmailDialog, requestEmailChange, cancelEmailChange,
	formatDate, formatWhen, formatUntil, describeAction,
} = await useSettings();

/**
 * The open flag lives in `useSettings`; the element lives here. This is the one
 * line between them.
 *
 * `showModal()` cannot be called during the same tick the element is created,
 * and the dialog is behind `v-if="isPreferences"` — so the watch waits a tick
 * before reaching for it rather than assuming it is already in the DOM.
 */
watch(emailDialogOpen, async (open) => {
	await nextTick();
	const dialog = emailDialog.value;
	if (!dialog) return;

	if (open && !dialog.open) {
		dialog.showModal();
		// showModal focuses the first tabbable thing, which is the close button
		// — so the dialog would open with the dismiss control highlighted rather
		// than the field you came here to fill in.
		dialog.querySelector<HTMLInputElement>(".field-input")?.focus();
	}
	else if (!open && dialog.open) {
		dialog.close();
	}
});

// Escape closes the dialog without going through closeEmailDialog, so the flag
// has to be caught up here. Guarded, or closing via Cancel would recurse: that
// path clears the flag, which closes the dialog, which fires this again.
function onEmailDialogClose() {
	if (emailDialogOpen.value) closeEmailDialog();
}

// A click landing on the <dialog> itself is a click on the backdrop — anything
// on the content hits .modal-panel and stops there.
function onEmailDialogClick(event: MouseEvent) {
	if (event.target === emailDialog.value) closeEmailDialog();
}
</script>
