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

		<!-- Shown once. There is no way to see this code again, by design. -->
		<section v-if="issuedInvite" class="dashPanel inviteDialog">
			<h2 class="dashPanel-title">Invite code for {{ issuedInvite.displayName }}</h2>
			<NuxtDashboardCopyField :value="issuedInvite.code" />
			<p class="dashPanel-note">
				Send this to {{ issuedInvite.slug }} directly. It works once, expires
				{{ formatDate(issuedInvite.expiresAt) }}, and <strong>will not be shown
					again</strong> — if it's lost, issue a new one.
			</p>
			<button type="button" class="btn btn--subtle" @click="issuedInvite = null">
				Done
			</button>
		</section>

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
					<NuxtAuthField
						v-model="createForm.whopUsername"
						label="Whop username"
						placeholder="optional"
						:error="createErrors.whopUsername"
						hint="Reference only — nothing is sent to Whop."
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
							<th scope="col">Sales</th>
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
								<ul class="adminChecks">
									<li :class="{ 'is-done': affiliate.hasWhopConfig }">Whop</li>
									<li :class="{ 'is-done': affiliate.hasLogin }">Login</li>
									<li :class="{ 'is-done': affiliate.hasTelegram }">Telegram</li>
									<li :class="{ 'is-done': affiliate.hasCalendly }">Calendly</li>
								</ul>
								<span v-if="affiliate.liveInvite" class="adminTable-invite">
									code {{ affiliate.liveInvite.prefix }}… until {{ formatDate(affiliate.liveInvite.expiresAt) }}
								</span>
							</td>
							<td>{{ affiliate.visits }}</td>
							<td>{{ affiliate.sales }}</td>
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
										v-if="!affiliate.hasWhopConfig"
										type="button"
										:disabled="busyId === affiliate.id"
										@click="whopOnboard(affiliate)"
									>Onboard Whop</button>

									<button
										v-if="!affiliate.hasLogin && !affiliate.liveInvite"
										type="button"
										:disabled="busyId === affiliate.id"
										@click="issueInvite(affiliate)"
									>Issue code</button>

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
							v-model="editForm.whopUsername"
							label="Whop username"
							placeholder="optional"
							:error="editErrors.whopUsername"
							hint="Reference only — nothing is sent to Whop."
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
	</div>
</template>

<script setup lang="ts">
import { useTemplateRef, watch } from "vue";
import { useAdmin, type AdminAffiliate, type AdminUser, DELETION_REASON_LABELS } from "~/assets/js/components/admin";

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
	issueInvite, revokeInvite, setStatus, viewAs, whopOnboard,
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

/** Revoking ends their sessions and kills their links — worth a confirm. */
function confirmStatus(affiliate: AdminAffiliate, status: AdminAffiliate["status"]) {
	const message = `Revoke ${affiliate.slug}? They'll be signed out immediately and their links stop swapping. Their sales history is kept.`;
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
