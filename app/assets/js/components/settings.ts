import { ref, reactive, computed } from "vue";
import { useAsyncData, useRequestHeaders } from "#imports";

/**
 * Settings tab state.
 *
 * Every write goes to a route that re-derives the affiliate from the session,
 * so nothing here is an access control — it only decides what to show and how
 * to report what came back.
 */

export interface SettingsData {
	profile: {
		displayName: string;
		slug: string;
		timezone: string;
		locale: string;
		email: string | null;
		memberSince: string;
	};
	slugChange: { nextAllowedAt: string | null; cooldownDays: number };
	sessions: {
		id: string;
		current: boolean;
		issuedAt: string;
		lastSeenAt: string;
		device: string;
		ip: string | null;
	}[];
	recentActivity: { at: string; action: string; ip: string | null }[];
	gdprRequests: {
		id: string;
		kind: string;
		status: string;
		executeAfter: string | null;
		createdAt: string;
	}[];
}

type Busy = "profile" | "slug" | "password" | "sessions" | "gdpr" | null;

/** Turns an audit action into something an affiliate can read. */
const ACTION_LABELS: Record<string, string> = {
	"auth.login": "Signed in",
	"auth.logout": "Signed out",
	"password.changed": "Password changed",
	"password.change_failed": "Failed password change",
	"profile.updated": "Profile updated",
	"slug.changed": "Link changed",
	"links.updated": "Links updated",
	"sessions.revoked_others": "Signed out other devices",
	"invite.redeemed": "Account created",
	"gdpr.exported": "Data exported",
	"gdpr.delete_requested": "Deletion requested",
	"gdpr.cancelled": "Deletion cancelled",
};

export async function useSettings() {
	const { data, refresh } = await useAsyncData<SettingsData>("affiliate-settings", () =>
		$fetch<SettingsData>("/api/affiliate/settings", {
			headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
		}));

	const banner = ref<{ variant: "error" | "success" | "warning" | "info"; text: string } | null>(null);
	const busy = ref<Busy>(null);
	const errors = ref<Record<string, string | undefined>>({});

	// Timezone is not here, deliberately. It is set from the profile menu, which
	// writes it on its own and then reloads the page data — every figure on the
	// dashboard was bucketed by the old zone server-side. Carrying a copy in
	// this form would mean `saveProfile` posting a stale zone back over a fresh
	// one whenever somebody changed it in the menu and then saved their name.
	const profile = reactive({
		displayName: data.value?.profile.displayName ?? "",
	});

	const slug = ref(data.value?.profile.slug ?? "");

	const passwords = reactive({
		currentPassword: "",
		newPassword: "",
		newPasswordConfirm: "",
	});

	const pendingDelete = computed(() =>
		data.value?.gdprRequests.find(r => r.kind === "delete" && r.status === "pending") ?? null);

	/** Surfaces the field-level message when the API named one. */
	function handle(error: unknown, fallback: string) {
		const payload = (error as { data?: { data?: { field?: string; message?: string }; statusMessage?: string } })?.data;
		const field = payload?.data?.field;
		const message = payload?.data?.message ?? payload?.statusMessage ?? fallback;

		if (field) errors.value[field] = message;
		else banner.value = { variant: "error", text: message };
	}

	async function run(kind: Busy, work: () => Promise<void>) {
		if (busy.value) return;
		busy.value = kind;
		errors.value = {};
		banner.value = null;
		try {
			await work();
		}
		finally {
			busy.value = null;
		}
	}

	const saveProfile = () => run("profile", async () => {
		try {
			await $fetch("/api/affiliate/profile", { method: "PATCH", body: { ...profile } });
			banner.value = { variant: "success", text: "Profile saved." };
			await refresh();
		}
		catch (error) { handle(error, "Could not save your profile."); }
	});

	const saveSlug = () => run("slug", async () => {
		try {
			const result = await $fetch<{ previousSlug: string; previousWorksUntil: string }>(
				"/api/affiliate/slug",
				{ method: "POST", body: { slug: slug.value } },
			);
			banner.value = {
				variant: "success",
				text: `Link changed. Your old one (?r=${result.previousSlug}) keeps working until ${new Date(result.previousWorksUntil).toLocaleDateString("en-GB")}. Allow about 5 minutes for the site to catch up.`,
			};
			await refresh();
		}
		catch (error) { handle(error, "Could not change your link."); }
	});


	const savePassword = () => run("password", async () => {
		if (passwords.newPassword !== passwords.newPasswordConfirm) {
			errors.value.newPasswordConfirm = "Passwords do not match";
			return;
		}
		try {
			await $fetch("/api/affiliate/password", { method: "POST", body: { ...passwords } });
			passwords.currentPassword = "";
			passwords.newPassword = "";
			passwords.newPasswordConfirm = "";
			banner.value = { variant: "success", text: "Password changed. Other devices have been signed out." };
			await refresh();
		}
		catch (error) { handle(error, "Could not change your password."); }
	});

	const signOutOthers = () => run("sessions", async () => {
		try {
			const result = await $fetch<{ signedOut: number }>("/api/affiliate/sessions", { method: "DELETE" });
			banner.value = {
				variant: "success",
				text: result.signedOut === 1 ? "One other device signed out." : `${result.signedOut} other devices signed out.`,
			};
			await refresh();
		}
		catch (error) { handle(error, "Could not sign out the other devices."); }
	});

	const gdpr = (action: "delete" | "cancel") => run("gdpr", async () => {
		try {
			await $fetch("/api/affiliate/gdpr", { method: "POST", body: { action } });
			banner.value = {
				variant: action === "delete" ? "warning" : "success",
				text: action === "delete"
					? "Deletion requested. Nothing is removed for 14 days — you can cancel any time before then."
					: "Deletion cancelled.",
			};
			await refresh();
		}
		catch (error) { handle(error, "Could not record that request."); }
	});

	function confirmDelete() {
		const message = "Request deletion of your affiliate account? Nothing is removed for 14 days and you can cancel at any point. Your sales history is part of what gets deleted.";
		if (window.confirm(message)) gdpr("delete");
	}

	/** Exported as a download rather than rendered — it can be a large file. */
	async function exportData() {
		await run("gdpr", async () => {
			try {
				const payload = await $fetch("/api/affiliate/gdpr", { method: "POST", body: { action: "export" } });
				const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = `${data.value?.profile.slug ?? "affiliate"}-data-export.json`;
				link.click();
				URL.revokeObjectURL(url);
			}
			catch (error) { handle(error, "Could not build your export."); }
		});
	}

	const formatDate = (iso: string | null) =>
		iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

	const formatWhen = (iso: string) => {
		const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
		if (minutes < 1) return "just now";
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return formatDate(iso);
	};

	const describeAction = (action: string) => ACTION_LABELS[action] ?? action;

	return {
		data, banner, busy, errors,
		profile, slug, passwords, pendingDelete,
		saveProfile, saveSlug, savePassword,
		signOutOthers, gdpr, confirmDelete, exportData,
		formatDate, formatWhen, describeAction,
	};
}
