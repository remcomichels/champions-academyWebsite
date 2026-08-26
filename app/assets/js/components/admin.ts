import { ref, reactive, computed } from "vue";
import { useRequestHeaders } from "#imports";
// $fetch is a Nuxt global — same as in login.ts, no import needed.

/**
 * Admin panel state.
 *
 * Everything here is a thin client over /api/admin/*. Those routes re-check
 * requireAdmin on every call — nothing in this file is an access control, it
 * only decides what to render.
 */

export interface AdminAffiliate {
	id: string;
	slug: string;
	displayName: string;
	status: "active" | "revoked";
	whopUsername: string | null;
	notes: string | null;
	hasWhopConfig: boolean;
	hasVipLink: boolean;
	hasTelegram: boolean;
	hasCalendly: boolean;
	hasLogin: boolean;
	createdAt: string;
	sales: number;
	visits: number;
	liveInvite: { prefix: string; expiresAt: string } | null;
}

export interface AdminUser {
	userId: string;
	email: string | null;
	isSelf: boolean;
	affiliateSlug: string | null;
	displayName: string | null;
	createdAt: string;
}

export interface IssuedInvite {
	slug: string;
	displayName: string;
	code: string;
	expiresAt: string;
}

function errorMessage(error: unknown, fallback: string): string {
	const data = (error as { data?: { statusMessage?: string } })?.data;
	return data?.statusMessage || fallback;
}

export function useAdmin() {
	const affiliates = ref<AdminAffiliate[]>([]);
	const loading = ref(false);
	const banner = ref<{ variant: "error" | "success"; text: string } | null>(null);
	const search = ref("");

	/** Shown once, in a dialog, and never recoverable afterwards. */
	const issuedInvite = ref<IssuedInvite | null>(null);

	const createForm = reactive({ slug: "", displayName: "", whopUsername: "" });
	const createErrors = ref<Record<string, string | undefined>>({});
	const creating = ref(false);

	/** The affiliate open in the edit dialog, or null when it is closed. */
	const editing = ref<AdminAffiliate | null>(null);
	/**
	 * Held separately from `editing` so the dialog's heading survives the close.
	 * The dialog stays mounted — it has to, or there is no element to call
	 * showModal on — so reading the name off `editing` blanked the title for the
	 * length of the closing frame.
	 */
	const editingName = ref("");
	const editForm = reactive({ slug: "", displayName: "", whopUsername: "", notes: "" });
	const editErrors = ref<Record<string, string | undefined>>({});
	const saving = ref(false);

	/** Per-affiliate spinner, so one slow action doesn't disable the whole table. */
	const busyId = ref<string | null>(null);

	const admins = ref<AdminUser[]>([]);
	const adminEmail = ref("");
	const adminError = ref<string | null>(null);
	const grantingAdmin = ref(false);
	const busyAdminId = ref<string | null>(null);

	const filtered = computed(() => {
		const term = search.value.trim().toLowerCase();
		if (!term) return affiliates.value;
		return affiliates.value.filter(a =>
			a.slug.includes(term) || a.displayName.toLowerCase().includes(term));
	});

	async function load() {
		loading.value = true;
		try {
			const data = await $fetch<{ affiliates: AdminAffiliate[] }>("/api/admin/affiliates", {
				// The session cookie is httpOnly, so it has to be forwarded by hand
				// during SSR. Without this the server-rendered pass is
				// unauthenticated, 404s, and the page paints an error banner before
				// the client quietly refetches and fixes itself.
				headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
			});
			affiliates.value = data.affiliates;
		}
		catch (error) {
			banner.value = { variant: "error", text: errorMessage(error, "Could not load affiliates.") };
		}
		finally {
			loading.value = false;
		}
	}

	async function loadAdmins() {
		try {
			const data = await $fetch<{ admins: AdminUser[] }>("/api/admin/admins", {
				headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
			});
			admins.value = data.admins;
		}
		catch (error) {
			banner.value = { variant: "error", text: errorMessage(error, "Could not load admins.") };
		}
	}

	async function grantAdmin() {
		if (grantingAdmin.value) return;

		adminError.value = null;
		banner.value = null;
		grantingAdmin.value = true;

		try {
			const data = await $fetch<{ email: string }>("/api/admin/admins", {
				method: "POST",
				body: { email: adminEmail.value },
			});

			adminEmail.value = "";
			banner.value = { variant: "success", text: `${data.email} can now open the admin panel.` };
			await loadAdmins();
		}
		catch (error) {
			const data = (error as { data?: { data?: { message?: string }; statusMessage?: string } })?.data;
			adminError.value = data?.data?.message ?? data?.statusMessage ?? "Could not grant admin access.";
		}
		finally {
			grantingAdmin.value = false;
		}
	}

	async function revokeAdmin(user: AdminUser) {
		busyAdminId.value = user.userId;
		banner.value = null;

		try {
			await $fetch(`/api/admin/admins/${user.userId}`, { method: "DELETE" });
			banner.value = {
				variant: "success",
				text: `${user.email ?? "That account"} no longer has admin access.`,
			};
			await loadAdmins();
		}
		catch (error) {
			banner.value = { variant: "error", text: errorMessage(error, "Could not remove admin access.") };
		}
		finally {
			busyAdminId.value = null;
		}
	}

	async function create() {
		if (creating.value) return;

		createErrors.value = {};
		banner.value = null;
		creating.value = true;

		try {
			await $fetch("/api/admin/affiliates", {
				method: "POST",
				body: {
					slug: createForm.slug,
					displayName: createForm.displayName,
					whopUsername: createForm.whopUsername || null,
				},
			});

			createForm.slug = "";
			createForm.displayName = "";
			createForm.whopUsername = "";
			banner.value = { variant: "success", text: "Affiliate created." };
			await load();
		}
		catch (error) {
			const data = (error as { data?: { data?: { field?: string; message?: string }; statusMessage?: string } })?.data;
			const field = data?.data?.field;
			if (field) createErrors.value[field] = data?.data?.message ?? data?.statusMessage;
			else banner.value = { variant: "error", text: errorMessage(error, "Could not create affiliate.") };
		}
		finally {
			creating.value = false;
		}
	}

	function startEdit(affiliate: AdminAffiliate) {
		editing.value = affiliate;
		editingName.value = affiliate.displayName;
		editErrors.value = {};
		banner.value = null;
		editForm.slug = affiliate.slug;
		editForm.displayName = affiliate.displayName;
		editForm.whopUsername = affiliate.whopUsername ?? "";
		editForm.notes = affiliate.notes ?? "";
	}

	function cancelEdit() {
		editing.value = null;
		editErrors.value = {};
	}

	async function saveEdit() {
		const affiliate = editing.value;
		if (!affiliate || saving.value) return;

		editErrors.value = {};
		banner.value = null;
		saving.value = true;

		try {
			const data = await $fetch<{
				changed: boolean;
				slug?: string;
				previousSlug?: string;
				previousWorksUntil?: string;
			}>(`/api/admin/affiliates/${affiliate.id}`, {
				method: "PATCH",
				body: {
					slug: editForm.slug,
					displayName: editForm.displayName,
					// Empty string clears a nullable field; the server maps it to null.
					whopUsername: editForm.whopUsername,
					notes: editForm.notes,
				},
			});

			banner.value = {
				variant: "success",
				text: !data.changed
					? "Nothing to save."
					: data.previousSlug
						// The rename is the part with a consequence outside this page,
						// so it is the part the confirmation talks about.
						? `Saved. ?r=${data.previousSlug} keeps working until ${
							new Date(data.previousWorksUntil!).toLocaleDateString("en-GB", {
								day: "numeric", month: "short", year: "numeric",
							})
						}.`
						: `${affiliate.displayName} updated.`,
			};

			editing.value = null;
			await load();
		}
		catch (error) {
			const data = (error as { data?: { data?: { field?: string; message?: string }; statusMessage?: string } })?.data;
			const field = data?.data?.field;
			if (field) editErrors.value[field] = data?.data?.message ?? data?.statusMessage;
			else banner.value = { variant: "error", text: errorMessage(error, "Could not save those changes.") };
		}
		finally {
			saving.value = false;
		}
	}

	async function issueInvite(affiliate: AdminAffiliate, expiresInDays = 7) {
		busyId.value = affiliate.id;
		banner.value = null;

		try {
			const data = await $fetch<{ code: string; expiresAt: string }>(
				`/api/admin/affiliates/${affiliate.id}/invite`,
				{ method: "POST", body: { expiresInDays } },
			);

			issuedInvite.value = {
				slug: affiliate.slug,
				displayName: affiliate.displayName,
				code: data.code,
				expiresAt: data.expiresAt,
			};

			await load();
		}
		catch (error) {
			banner.value = { variant: "error", text: errorMessage(error, "Could not issue a code.") };
		}
		finally {
			busyId.value = null;
		}
	}

	async function revokeInvite(affiliate: AdminAffiliate) {
		busyId.value = affiliate.id;
		try {
			await $fetch(`/api/admin/affiliates/${affiliate.id}/invite`, { method: "DELETE" });
			banner.value = { variant: "success", text: `Code for ${affiliate.slug} revoked.` };
			await load();
		}
		catch (error) {
			banner.value = { variant: "error", text: errorMessage(error, "Could not revoke the code.") };
		}
		finally {
			busyId.value = null;
		}
	}

	async function setStatus(affiliate: AdminAffiliate, status: AdminAffiliate["status"]) {
		busyId.value = affiliate.id;
		try {
			await $fetch(`/api/admin/affiliates/${affiliate.id}/status`, {
				method: "POST",
				body: { status },
			});
			banner.value = {
				variant: "success",
				text: status === "active"
					? `${affiliate.slug} reactivated.`
					: `${affiliate.slug} revoked. Their sessions were ended and their link stopped swapping.`,
			};
			await load();
		}
		catch (error) {
			banner.value = { variant: "error", text: errorMessage(error, "Could not change status.") };
		}
		finally {
			busyId.value = null;
		}
	}

	async function viewAs(affiliate: AdminAffiliate) {
		busyId.value = affiliate.id;
		banner.value = null;

		try {
			await $fetch("/api/admin/view-as", {
				method: "POST",
				body: { affiliateId: affiliate.id },
			});

			// Hard navigation, not navigateTo: every composable in the dashboard
			// holds data fetched as the admin, and the whole shell has to come
			// back as the affiliate being viewed.
			window.location.href = "/dashboard";
		}
		catch (error) {
			banner.value = { variant: "error", text: errorMessage(error, "Could not open that dashboard.") };
			busyId.value = null;
		}
	}

	async function whopOnboard(affiliate: AdminAffiliate) {
		busyId.value = affiliate.id;
		banner.value = null;

		try {
			const data = await $fetch<{
				alreadyOnboarded: boolean;
				urlStored?: boolean;
				purchaseUrl?: string | null;
			}>(`/api/admin/affiliates/${affiliate.id}/whop-onboard`, { method: "POST", body: {} });

			banner.value = data.alreadyOnboarded
				? { variant: "success", text: `${affiliate.slug} already has a checkout configuration.` }
				: data.urlStored
					? { variant: "success", text: `${affiliate.slug} onboarded — their VIP link is live.` }
					: {
							variant: "success",
							text: `${affiliate.slug} onboarded, but the link is on a sandbox host so it was not stored. Their VIP buttons keep the site default.`,
						};

			await load();
		}
		catch (error) {
			banner.value = { variant: "error", text: errorMessage(error, "Whop onboarding failed.") };
		}
		finally {
			busyId.value = null;
		}
	}

	return {
		affiliates: filtered,
		search,
		loading,
		banner,
		busyId,
		issuedInvite,
		createForm,
		createErrors,
		creating,
		editing,
		editingName,
		editForm,
		editErrors,
		saving,
		admins,
		adminEmail,
		adminError,
		grantingAdmin,
		busyAdminId,
		load,
		loadAdmins,
		grantAdmin,
		revokeAdmin,
		create,
		startEdit,
		cancelEdit,
		saveEdit,
		issueInvite,
		revokeInvite,
		setStatus,
		viewAs,
		whopOnboard,
	};
}
