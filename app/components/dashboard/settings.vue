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

		<!-- Connections ─────────────────────────────────────────────────── -->
		<!-- Built and then deliberately obscured. The panel underneath is the
		     real thing rather than a mock — when the OAuth lands in V3 the
		     `teaser` wrapper comes off and the rows are already here — but until
		     then the buttons are `span`s, not `button`s, so there is nothing to
		     press, nothing in the tab order, and no disabled control to explain.
		     Showing a blurred shape of what is coming beats an empty section,
		     and beats three live buttons that do nothing. -->
		<section v-if="isPreferences" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Connections</h2>
				<p class="settingsBlock-text">Link the platforms you post on, so your reach and what performs best sit beside your sales.</p>
			</header>

			<div class="dashPanel teaser">
				<!-- Hidden from assistive tech rather than merely blurred. The
				     heading and the badge above and over it already say
				     everything this list would, and reading out three rows of
				     unavailable actions is worse than not reading them. -->
				<div class="teaser-veiled" aria-hidden="true">
					<div v-for="platform in CONNECTIONS" :key="platform.name" class="signinRow">
						<!-- Empty alt on purpose. The platform's name is the very
						     next element, so a description here would have a
						     screen reader say it twice — and the whole veil is
						     aria-hidden anyway. -->
						<span class="signinRow-icon signinRow-icon--logo">
							<NuxtAppImage :src="platform.logo" alt="" />
						</span>

						<div class="signinRow-body">
							<span class="signinRow-label">{{ platform.name }}</span>
							<span class="signinRow-value">{{ platform.blurb }}</span>
						</div>

						<div class="signinRow-actions">
							<span class="btn btn--subtle">Connect</span>
						</div>
					</div>
				</div>

				<p class="teaser-badge">Coming in V3</p>
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
					<button
						type="submit"
						class="btn btn--primary dashForm-submit"
						:disabled="busy === 'slug' || !slugDirty"
					>
						{{ busy === "slug" ? "Changing…" : "Change link" }}
					</button>
				</form>
			</div>
		</section>

		<!-- Appearance ──────────────────────────────────────────────────── -->
		<section v-if="isPreferences" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Appearance</h2>
				<p class="settingsBlock-text">Choose how the dashboard looks and behaves.</p>
			</header>

			<div class="dashPanel">
				<!-- A div, not a form. `.dashForm--split` is a layout — label and
				     hint in one column, the control in the other, ruled edge to
				     edge — and nothing in here submits. -->
				<div class="dashForm dashForm--split dashForm--noActions">
					<div class="field appearanceTheme">
						<span id="themeModeLabel" class="field-label">Theme mode</span>
						<p class="field-message">Choose how the dashboard looks to you. Pick one, or follow your system.</p>

						<div class="field-control themeGrid" role="radiogroup" aria-labelledby="themeModeLabel">
							<label
								v-for="option in themeOptions"
								:key="option.value"
								class="themeCard"
								:class="{ 'is-chosen': themeChoice === option.value }"
							>
								<!-- System draws both palettes rather than picking
								     one: the whole point of the option is that it
								     is whichever the machine is asking for. -->
								<span
									v-if="option.value === 'system'"
									class="themeCard-frame themeCard-frame--split"
									aria-hidden="true"
								>
									<span class="themeCard-face" data-theme="dark">
										<NuxtDashboardThemePreview />
									</span>
									<span class="themeCard-face themeCard-face--second" data-theme="light">
										<NuxtDashboardThemePreview />
									</span>
								</span>

								<span v-else class="themeCard-frame" aria-hidden="true">
									<span class="themeCard-face" :data-theme="option.value">
										<NuxtDashboardThemePreview />
									</span>
								</span>

								<span class="themeCard-foot">
									<input
										class="themeCard-radio"
										type="radio"
										name="theme-mode"
										:value="option.value"
										:checked="themeChoice === option.value"
										@change="setTheme(option.value)"
									>
									<span class="themeCard-name">{{ option.label }}</span>
								</span>
							</label>
						</div>
					</div>

					<NuxtDashboardSelectField
						:model-value="sidebarMode"
						:options="sidebarOptions"
						label="Sidebar behaviour"
						hint="Applies to the main rail. Collapsed keeps it to icons, named on hover."
						@update:model-value="setSidebarMode($event as SidebarMode)"
					/>
				</div>
			</div>
		</section>

		<!-- Danger zone ────────────────────────────────────────────────── -->
		<!-- Here rather than under Security, which is about keeping other people
		     out of the account. Closing it is not a defence against anybody — it
		     is the last thing that is yours to decide about it, which is what
		     the rest of this tab is.

		     It offered a data export beside this until nobody used it: not one
		     request in the lifetime of the feature, so it came out along with
		     the route that built it.

		     "Request", not "Delete", because that is honestly what happens. The
		     route queues the ask and a person acts on it — deleting an affiliate
		     cascades into their conversions, which is the record of sales the
		     commission was already paid on, so it is a decision with an
		     accounting consequence rather than a button press. A control saying
		     "Delete my account" would name something this deliberately does not
		     do. -->
		<section v-if="isPreferences" class="settingsBlock">
			<header class="settingsBlock-head">
				<h2 class="settingsBlock-title">Danger zone</h2>
				<p class="settingsBlock-text">The one thing on this page that does not come back.</p>
			</header>

			<div class="dangerZone">
				<span class="dangerZone-icon" aria-hidden="true">
					<NuxtDashboardIcon name="warning" />
				</span>

				<div class="dangerZone-body">
					<h3 class="dangerZone-title">Request account deletion</h3>

					<p v-if="pendingDelete" class="dangerZone-text">
						Asked for. Nothing is touched until
						<strong>{{ formatDate(pendingDelete.executeAfter) }}</strong>, so there is still
						time to change your mind — after that the account and its sales history go.
					</p>

					<p v-else class="dangerZone-text">
						There is no undoing this once it goes through. You have 14 days to call it
						off; after that the account, your link and every sale recorded against it
						are removed.
					</p>
				</div>

				<div class="dangerZone-actions">
					<button
						v-if="pendingDelete"
						type="button"
						class="btn btn--danger"
						:disabled="busy === 'gdpr'"
						@click="gdpr('cancel')"
					>Keep my account</button>

					<button
						v-else
						type="button"
						class="btn btn--danger"
						:disabled="busy === 'gdpr'"
						@click="openDeleteDialog"
					>Request account deletion</button>
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

		<!-- Asking why, on the way out. Same dialog as Update email address —
		     `showModal()` for the focus trap, Escape and top-layer stacking — and
		     it replaces a `window.confirm`, which could not carry a question and
		     looked like the browser asking rather than us. -->
		<dialog
			v-if="isPreferences"
			ref="deleteDialog"
			class="modal modal--compact"
			@close="onDeleteDialogClose"
			@click="onDeleteDialogClick"
		>
			<form class="modal-panel" novalidate @submit.prevent="requestDelete">
				<header class="modal-head">
					<h2 class="modal-title">Request account deletion</h2>
					<button type="button" class="modal-close" aria-label="Close" @click="closeDeleteDialog">
						<NuxtDashboardIcon name="close" />
					</button>
				</header>

				<div class="modal-body">
					<NuxtDashboardSelectField
						v-model="deleteReason"
						:options="DELETE_REASONS"
						label="Why are you leaving?"
						:disabled="busy === 'gdpr'"
					/>

					<NuxtAuthField
						v-model="deleteNote"
						label="Anything you'd add?"
						placeholder="Optional"
						:disabled="busy === 'gdpr'"
						hint="Nothing here changes the outcome — it only tells us what to fix."
					/>

					<p class="modal-warning">
						Your account is removed in 14 days. You can call it off from this page any
						time before then; after that it cannot be undone.
					</p>
				</div>

				<footer class="modal-foot">
					<button type="button" class="btn btn--ghost" :disabled="busy === 'gdpr'" @click="closeDeleteDialog">
						Cancel
					</button>
					<button type="submit" class="btn btn--danger" :disabled="busy === 'gdpr'">
						{{ busy === "gdpr" ? "Sending…" : "Request deletion" }}
					</button>
				</footer>
			</form>
		</dialog>

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
						@blur="validateNewEmail"
					/>
				</div>

				<footer class="modal-foot">
					<button type="button" class="btn btn--ghost" :disabled="busy === 'email'" @click="closeEmailDialog">
						Cancel
					</button>
					<button type="submit" class="btn btn--primary" :disabled="busy === 'email' || !newEmailValid">
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
import type { SidebarMode } from "~/composables/useSidebarMode";

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
 * The platforms the Connections block will link to, in the order they are
 * drawn.
 *
 * A list rather than three copies of the same markup because the rows differ
 * only by their three strings, and because what comes next is this array
 * gaining a `connected` flag and an href per platform rather than the template
 * gaining branches.
 */
const CONNECTIONS = [
	{ name: "TikTok", logo: "/images/tiktok-logo.webp", blurb: "Views, follows and what each post sent your way." },
	{ name: "Instagram", logo: "/images/instagram-logo.webp", blurb: "Reach and profile taps from posts, reels and stories." },
	{ name: "YouTube", logo: "/images/youtube-logo.webp", blurb: "Watch time and subscribers earned from your videos." },
] as const;

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
const deleteDialog = useTemplateRef<HTMLDialogElement>("deleteDialog");

/**
 * Theme and rail behaviour both come straight from their composables, with no
 * copy held here and no Save to press.
 *
 * Every other control on this page edits a draft and posts it. These two are
 * different in kind: the thing they change is the page you are looking at, so
 * the preview *is* the confirmation — staging them behind a Save would mean
 * choosing a theme, seeing nothing happen, and pressing a button to find out.
 * Both write a cookie of their own, so there is nothing to persist here either.
 *
 * `useState` inside both composables is what keeps this in step with the
 * switcher in the account menu: they are two views of one ref, not two copies.
 */
const { choice: themeChoice, setTheme, options: themeOptions } = useTheme();
const { mode: sidebarMode, setSidebarMode, options: sidebarOptions } = useSidebarMode();

const {
	data, banner, busy, errors,
	profile, slug, pendingDelete,
	profileDirty, slugDirty, resetProfile,
	saveProfile, saveSlug,
	signOutOthers, gdpr, requestDelete,
	DELETE_REASONS, deleteDialogOpen, deleteReason, deleteNote,
	openDeleteDialog, closeDeleteDialog,
	emailDialogOpen, newEmail, emailError, newEmailValid,
	openEmailDialog, closeEmailDialog, validateNewEmail, requestEmailChange, cancelEmailChange,
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

/**
 * Clears "Invalid email" as soon as the address is being corrected.
 *
 * Registered here rather than in `useSettings` because the composable awaits
 * `useAsyncData` internally, and a watcher created after that await has no
 * component instance to be bound to — it would outlive the page. The awaits in
 * this file are compiled with `withAsyncContext`, so anything registered below
 * them is scoped and stops on unmount.
 */
watch(newEmail, () => {
	if (errors.value.email) errors.value.email = undefined;
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

// The deletion dialog, wired the same way. Its opening focus is deliberately
// left where showModal puts it — on the close button — rather than moved to the
// reason picker: the first control in a dialog that deletes an account should
// be the way out of it.
watch(deleteDialogOpen, async (open) => {
	await nextTick();
	const dialog = deleteDialog.value;
	if (!dialog) return;

	if (open && !dialog.open) dialog.showModal();
	else if (!open && dialog.open) dialog.close();
});

function onDeleteDialogClose() {
	if (deleteDialogOpen.value) closeDeleteDialog();
}

function onDeleteDialogClick(event: MouseEvent) {
	if (event.target === deleteDialog.value) closeDeleteDialog();
}
</script>
