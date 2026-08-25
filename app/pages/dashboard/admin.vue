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
					hint="Needed by Whop to pay their commission."
				/>
				<button type="submit" class="btn btn--primary adminForm-submit" :disabled="creating">
					{{ creating ? "Adding…" : "Add affiliate" }}
				</button>
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
							</td>
							<td>
								<ul class="adminChecks">
									<li :class="{ 'is-done': affiliate.hasWhopConfig }">Whop</li>
									<li :class="{ 'is-done': affiliate.hasLogin }">Login</li>
									<li :class="{ 'is-done': affiliate.hasTelegram }">Telegram</li>
									<li :class="{ 'is-done': affiliate.hasCalendly }">Calendly</li>
								</ul>
								<span v-if="affiliate.liveInvite" class="adminTable-invite">
									code {{ affiliate.liveInvite.prefix }}… outstanding
								</span>
							</td>
							<td>{{ affiliate.visits }}</td>
							<td>{{ affiliate.sales }}</td>
							<td>
								<div class="adminActions">
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
	</div>
</template>

<script setup lang="ts">
import { useAdmin, type AdminAffiliate } from "~/assets/js/components/admin";

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
	load, create, issueInvite, revokeInvite, setStatus, whopOnboard,
} = useAdmin();

await load();

/** Revoking ends their sessions and stops their links — worth a confirm. */
function confirmStatus(affiliate: AdminAffiliate, status: AdminAffiliate["status"]) {
	const message = `Revoke ${affiliate.slug}? They'll be signed out immediately and their links stop swapping within 5 minutes. Their sales history is kept.`;
	if (window.confirm(message)) setStatus(affiliate, status);
}

const formatDate = (iso: string) =>
	new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
</script>
