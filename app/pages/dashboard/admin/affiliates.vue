<template>
	<div class="dash">
		<!-- h2, not h1. The dashboard layout renders an sr-only h1 with the
		     page's own name on every tab, so a second one here gave this page
		     two — and the one that would win is the one repeating the nav
		     label. Every other tab heads its content at h2. -->
		<header class="dash-head">
			<p class="dash-preTitle">Admin</p>
			<h2 class="dash-title">Affiliates</h2>
		</header>

		<NuxtAlertBanner v-if="banner" :variant="banner.variant">
			{{ banner.text }}
		</NuxtAlertBanner>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Add an affiliate</h2>
			<form class="adminForm" novalidate @submit.prevent="create">
				<div class="adminForm-fields">
					<NuxtAuthField
						v-model="createForm.slug"
						label="Slug"
						placeholder="remco"
						:error="createErrors.slug"
						hint="Their ?r= value. Lowercase letters, numbers and dashes."
						required
					/>
					<NuxtAuthField
						v-model="createForm.displayName"
						label="Name"
						placeholder="Remco Michels"
						:error="createErrors.displayName"
						required
					/>
				</div>
				<div class="adminForm-actions">
					<button type="submit" class="btn btn--primary adminForm-submit" :disabled="creating">
						{{ creating ? "Adding…" : "Add affiliate" }}
					</button>
				</div>
			</form>
		</section>

		<section class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">All affiliates</h2>
				<input v-model="search" class="field-input adminSearch" type="search" placeholder="Search…">
			</div>

			<p v-if="loading" class="dashPanel-note">Loading…</p>
			<p v-else-if="!affiliates.length" class="dashPanel-empty">No affiliates yet.</p>

			<div v-else class="adminTableWrap">
				<table class="dataTable adminTable">
					<thead>
						<tr>
							<th scope="col">Affiliate</th>
							<th scope="col">Setup</th>
							<th scope="col">Visits</th>
							<th scope="col">Actions</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="affiliate in affiliates" :key="affiliate.id">
							<td>
								<span class="adminTable-name">{{ affiliate.displayName }}</span>
								<span class="adminTable-slug">?r={{ affiliate.slug }}</span>
								<span class="adminTable-status" :class="`is-${affiliate.status}`">{{ affiliate.status }}</span>
								<!-- Only ever drawn for somebody who has asked to be
								     deleted, which is the point: nothing else on any
								     admin screen says that they have. The date is the
								     deadline they were shown on their own settings
								     page, so this is the same promise seen from the
								     side that has to keep it. -->
								<span
									v-if="affiliate.pendingDeletion"
									class="adminTable-status is-deleting"
								>Deleting {{ formatDate(affiliate.pendingDeletion.on) }}</span>

								<!-- Under the chip rather than inside it. The chip is
								     the alarm and has to stay scannable down a column;
								     the reason is the thing you read once the alarm has
								     caught you, and it is the only place anybody sees it
								     — the request row goes with the purge. -->
								<span v-if="affiliate.pendingDeletion" class="adminTable-reason">
									{{ DELETION_REASON_LABELS[affiliate.pendingDeletion.reason ?? ""] ?? "No reason given" }}
									<template v-if="affiliate.pendingDeletion.note">
										— “{{ affiliate.pendingDeletion.note }}”
									</template>
								</span>
							</td>
							<td>
								<!-- The account state first, because it is the one that says
								     whether anything is waiting on somebody. The three checks
								     under it are what they have filled in once they are in. -->
								<p class="inviteState" :class="`is-${affiliate.inviteState}`">
									<span class="inviteState-dot" aria-hidden="true" />
									{{ INVITE_STATE_LABELS[affiliate.inviteState] }}
								</p>

								<ul class="adminChecks">
									<li :class="{ 'is-done': affiliate.hasLogin }">Login</li>
									<li :class="{ 'is-done': affiliate.hasTelegram }">Telegram</li>
									<li :class="{ 'is-done': Boolean(affiliate.herofxCode) }">HeroFX</li>
								</ul>

								<!-- The code itself, and how it got there. "Matched"
								     means the sync recognised their login address in
								     the feed; "set by hand" is the fallback, and the
								     one worth being able to spot when a figure looks
								     wrong. -->
								<span v-if="affiliate.herofxCode" class="adminTable-slug">
									IB {{ affiliate.herofxCode }} ·
									{{ affiliate.herofxCodeSource === "admin" ? "set by hand" : "matched" }}
								</span>
								<!-- The prefix, not the code. Only the first group is stored —
								     enough to tell two outstanding invites apart, never enough
								     to redeem one. Worded so it cannot be mistaken for a
								     truncated code somebody could go looking for the rest of. -->
								<span v-if="affiliate.liveInvite" class="adminTable-invite">
									invite starting {{ affiliate.liveInvite.prefix }}, valid until
									{{ formatDate(affiliate.liveInvite.expiresAt) }}
								</span>
							</td>
							<td>{{ affiliate.visits }}</td>
							<td>
								<div class="adminActions">
									<button
										type="button"
										:disabled="busyId === affiliate.id"
										@click="startEdit(affiliate)"
									>Edit</button>

									<button
										type="button"
										:disabled="busyId === affiliate.id"
										@click="viewAs(affiliate)"
									>View as</button>

									<button
										v-if="!affiliate.hasLogin && !affiliate.liveInvite"
										type="button"
										:disabled="busyId === affiliate.id"
										@click="issueInvite(affiliate)"
									>Issue code</button>

									<!-- The recovery path, and one click.
									     A code is shown once and never stored in the clear, so
									     losing it means issuing another — and this used to be
									     reachable only by revoking first, which is two steps
									     where the frightening-sounding one comes first. The
									     endpoint already revokes whatever is outstanding before
									     it inserts, so this is the same operation without the
									     detour. -->
									<button
										v-if="affiliate.liveInvite"
										type="button"
										:disabled="busyId === affiliate.id"
										@click="confirmReissue(affiliate)"
									>Reissue code</button>

									<button
										v-if="affiliate.liveInvite"
										type="button"
										:disabled="busyId === affiliate.id"
										@click="revokeInvite(affiliate)"
									>Revoke code</button>

									<button
										v-if="affiliate.status === 'active'"
										type="button"
										class="is-danger"
										:disabled="busyId === affiliate.id"
										@click="confirmStatus(affiliate, 'revoked')"
									>Revoke access</button>

									<button
										v-else
										type="button"
										:disabled="busyId === affiliate.id"
										@click="setStatus(affiliate, 'active')"
									>Reactivate</button>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Admin access</h2>
			<p class="dashPanel-note">
				Admins can see and change every affiliate here. Granting it needs an
				account that already exists — people get one by redeeming an invite.
			</p>

			<form class="adminForm" novalidate @submit.prevent="grantAdmin">
				<div class="adminForm-fields">
					<NuxtAuthField
						v-model="adminEmail"
						label="Email"
						type="email"
						inputmode="email"
						autocomplete="off"
						:error="adminError"
						required
					/>
				</div>
				<div class="adminForm-actions">
					<button type="submit" class="btn btn--primary adminForm-submit" :disabled="grantingAdmin">
						{{ grantingAdmin ? "Granting…" : "Grant admin" }}
					</button>
				</div>
			</form>

			<ul class="adminList">
				<li v-for="user in admins" :key="user.userId" class="adminList-row">
					<span class="adminList-who">
						<span class="adminList-email">{{ user.email ?? user.userId }}</span>
						<span v-if="user.displayName" class="adminList-meta">{{ user.displayName }} · ?r={{ user.affiliateSlug }}</span>
					</span>

					<!-- No Remove on your own row. The endpoint refuses it too; this
					     just avoids offering a button that always fails. -->
					<span v-if="user.isSelf" class="adminList-self">You</span>
					<button
						v-else
						type="button"
						class="is-danger"
						:disabled="busyAdminId === user.userId"
						@click="confirmRevokeAdmin(user)"
					>Remove</button>
				</li>
			</ul>
		</section>

		<!-- Native <dialog>, not a div with a high z-index: showModal() gives
		     focus trapping, Escape, inert background and top-layer stacking that
		     no sidebar or sticky header can paint over. It stays mounted while
		     closed — there has to be an element to call showModal on. -->
		<dialog ref="editDialog" class="modal" @close="onDialogClose" @click="onDialogClick">
			<div class="modal-panel">
				<header class="modal-head">
					<h2 class="modal-title">Edit {{ editingName }}</h2>
					<button type="button" class="modal-close" aria-label="Close" @click="cancelEdit">
						<NuxtDashboardIcon name="close" />
					</button>
				</header>

				<form class="adminForm" novalidate @submit.prevent="saveEdit">
					<div class="adminForm-fields">
						<NuxtAuthField
							v-model="editForm.slug"
							label="Slug"
							:error="editErrors.slug"
							hint="Changing this keeps the old ?r= working for 90 days, so printed links survive."
							required
						/>
						<NuxtAuthField
							v-model="editForm.displayName"
							label="Name"
							:error="editErrors.displayName"
							required
						/>
						<NuxtAuthField
							v-model="editForm.herofxCode"
							label="HeroFX partner code"
							placeholder="2189546"
							:error="editErrors.herofxCode"
							hint="Only needed when the automatic match fails — that happens when they signed up here with a different email than at HeroFX. Clear it to unlink."
						/>
						<div class="field adminForm-wide">
							<label class="field-label" for="affiliateNotes">Notes</label>
							<textarea
								id="affiliateNotes"
								v-model="editForm.notes"
								class="field-input adminForm-notes"
								rows="3"
								placeholder="Private to admins."
							/>
						</div>
					</div>
					<div class="adminForm-actions">
						<button type="submit" class="btn btn--primary" :disabled="saving">
							{{ saving ? "Saving…" : "Save changes" }}
						</button>
						<button type="button" class="btn btn--subtle" :disabled="saving" @click="cancelEdit">
							Cancel
						</button>
					</div>
				</form>
			</div>
		</dialog>

		<!-- The code, shown once and only here.
		     A modal rather than a panel on the page: this is the single moment
		     the plaintext exists anywhere, the server keeps only a hash of it,
		     and the button that produces it sits in a table that can be a long
		     way down. A panel above the fold is a panel that gets missed, and
		     the cost of missing it is reissuing. showModal() also puts it in
		     the top layer with the background inert, so there is nothing else
		     on screen to read instead — which is how the row's prefix came to
		     be mistaken for the code. -->
		<dialog ref="inviteDialog" class="modal modal--compact" @close="onInviteClose" @click="onInviteClick">
			<div class="modal-panel">
				<header class="modal-head">
					<h2 class="modal-title">Invite code for {{ issuedInvite?.displayName }}</h2>
					<button type="button" class="modal-close" aria-label="Close" @click="issuedInvite = null">
						<NuxtDashboardIcon name="close" />
					</button>
				</header>

				<div class="modal-body">
					<p class="modal-lead">
						Send this to {{ issuedInvite?.slug }} directly — by Telegram or on a
						call. They enter it at sign-in under
						<strong>"I have an invite code"</strong>.
					</p>

					<NuxtDashboardCopyField v-if="issuedInvite" :value="issuedInvite.code" class="inviteCode" />

					<p class="modal-warning">
						It works once, expires {{ issuedInvite ? formatDate(issuedInvite.expiresAt) : "" }},
						and <strong>will not be shown again</strong> — only a hash of it is
						stored. If it is lost, issue a new one, which revokes this.
					</p>
				</div>

				<footer class="modal-foot">
					<button type="button" class="btn btn--primary" @click="issuedInvite = null">
						I've copied it
					</button>
				</footer>
			</div>
		</dialog>
	</div>
</template>

<script setup lang="ts">
import { useTemplateRef, watch } from "vue";
import { useAdmin, type AdminAffiliate, type AdminUser, DELETION_REASON_LABELS, INVITE_STATE_LABELS } from "~/assets/js/components/admin";

definePageMeta({
	layout: "dashboard",
	middleware: "admin",
});

useSeoMeta({
	title: "Admin",
	robots: "noindex, nofollow",
});

const {
	affiliates, search, loading, banner, busyId, issuedInvite,
	createForm, createErrors, creating,
	editing, editingName, editForm, editErrors, saving,
	admins, adminEmail, adminError, grantingAdmin, busyAdminId,
	load, loadAdmins, grantAdmin, revokeAdmin,
	create, startEdit, cancelEdit, saveEdit,
	issueInvite, revokeInvite, setStatus, viewAs,
} = useAdmin();

await Promise.all([load(), loadAdmins()]);

const editDialog = useTemplateRef<HTMLDialogElement>("editDialog");

// `editing` stays the single source of truth and the dialog follows it, rather
// than the two being opened and closed independently and drifting apart.
watch(editing, async (affiliate) => {
	const dialog = editDialog.value;
	if (!dialog) return;

	if (affiliate && !dialog.open) {
		dialog.showModal();
		// showModal focuses the first tabbable thing, which is the close button
		// — so the dialog opens with the dismiss control highlighted rather than
		// the field you came here to change. Wait a tick for the fields to be in
		// the DOM before reaching for one.
		await nextTick();
		dialog.querySelector<HTMLInputElement>(".field-input")?.focus();
	}
	else if (!affiliate && dialog.open) {
		dialog.close();
	}
});

// Escape closes the dialog without going through cancelEdit, so the state has
// to be caught up here. Guarded, or closing via Cancel would recurse: that path
// nulls `editing` first, which closes the dialog, which fires this again.
function onDialogClose() {
	if (editing.value) cancelEdit();
}

// A click landing on the <dialog> itself is a click on the backdrop — anything
// on the content hits .modal-panel and stops there.
function onDialogClick(event: MouseEvent) {
	if (event.target === editDialog.value) cancelEdit();
}

// The same hold on the page as the account dialogs, for the same reason: Lenis
// scrolls programmatically and does not care what `overflow` says.
useScrollLock(computed(() => editing.value !== null));

// The invite dialog, wired exactly like the edit one above. `issuedInvite` stays
// the single source of truth and the element follows it.
//
// Opening focus is left where showModal puts it — on the close button — rather
// than moved to the copy control: the code is the thing to read, and pulling
// focus onto a button would have a screen reader announce "Copy" before the
// text it copies.
const inviteDialog = useTemplateRef<HTMLDialogElement>("inviteDialog");

watch(issuedInvite, async (invite) => {
	await nextTick();
	const dialog = inviteDialog.value;
	if (!dialog) return;

	if (invite && !dialog.open) dialog.showModal();
	else if (!invite && dialog.open) dialog.close();
});

// Escape closes the dialog without clearing the state behind it. Guarded, or
// dismissing via either button would recurse.
function onInviteClose() {
	if (issuedInvite.value) issuedInvite.value = null;
}

// A click on the <dialog> itself is the backdrop; content hits .modal-panel.
function onInviteClick(event: MouseEvent) {
	if (event.target === inviteDialog.value) issuedInvite.value = null;
}

useScrollLock(computed(() => issuedInvite.value !== null));

/**
 * Reissuing kills the outstanding code, so it is worth a beat.
 *
 * Confirmed rather than instant because the usual reason to reach for it is
 * having lost the code — and if the affiliate is already holding one, this
 * silently stops it working and they get a dead code with no explanation.
 */
function confirmReissue(affiliate: AdminAffiliate) {
	const message = `Issue a new code for ${affiliate.slug}? The one outstanding stops working immediately, so only do this if it was lost or never reached them.`;
	if (window.confirm(message)) issueInvite(affiliate);
}

/** Revoking ends their sessions and kills their links — worth a confirm. */
function confirmStatus(affiliate: AdminAffiliate, status: AdminAffiliate["status"]) {
	const message = `Revoke ${affiliate.slug}? They'll be signed out immediately and their links stop swapping. Their traffic history is kept.`;
	if (window.confirm(message)) setStatus(affiliate, status);
}

/** Handing someone the keys is worth a confirm; taking them back is too. */
function confirmRevokeAdmin(user: AdminUser) {
	const who = user.email ?? "this account";
	if (window.confirm(`Remove admin access for ${who}? Their affiliate account, if they have one, is untouched.`)) {
		revokeAdmin(user);
	}
}

const formatDate = (iso: string) =>
	new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
</script>
