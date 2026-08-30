import { ref, reactive, computed } from "vue";
import { useAsyncData, useRequestHeaders } from "#imports";
// Explicit, like the two lines above it. Nuxt's auto-import transform does not
// run on `app/assets/js/**` — only on the scanned directories, which is why
// nothing in this file has ever relied on it — and the generated types are
// global regardless, so `vue-tsc` and the production build both pass on an
// identifier that is undefined at runtime. There is no error until the handler
// actually fires.
import { isValidEmail } from "#shared/utils/email";

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
		firstName: string;
		lastName: string;
		slug: string;
		timezone: string;
		locale: string;
		email: string | null;
		memberSince: string;
	};
	/** The address waiting on a confirmation link, or null when none is. */
	pendingEmailChange: { email: string; expiresAt: string } | null;
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

type Busy = "profile" | "slug" | "email" | "sessions" | "gdpr" | null;

/** Turns an audit action into something an affiliate can read. */
const ACTION_LABELS: Record<string, string> = {
	"auth.login": "Signed in",
	"auth.logout": "Signed out",
	"password.changed": "Password changed",
	"password.change_failed": "Failed password change",
	"profile.updated": "Profile updated",
	"slug.changed": "Link changed",
	"email.change_requested": "Email change requested",
	"email.change_cancelled": "Email change cancelled",
	"email.changed": "Email address changed",
	"links.updated": "Links updated",
	"sessions.revoked_others": "Signed out other devices",
	"invite.redeemed": "Account created",
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
		firstName: data.value?.profile.firstName ?? "",
		lastName: data.value?.profile.lastName ?? "",
	});

	const slug = ref(data.value?.profile.slug ?? "");

	/**
	 * The Update-email dialog.
	 *
	 * Open state lives here rather than in the component because the request it
	 * makes lives here: the dialog closes on a successful send and stays open on
	 * a rejected address, and splitting "is it open" from "did it work" across
	 * two files is how those two get out of step. The component keeps only the
	 * <dialog> element itself, which is the part that has to be a DOM node.
	 */
	const emailDialogOpen = ref(false);
	const newEmail = ref("");

	/**
	 * Form-level failures from the dialog, shown inside it.
	 *
	 * Not `banner`. A <dialog> opened with showModal() renders in the top layer,
	 * over the toast that reports everything else on this page — so a throttled
	 * or refused request would set a message the person who caused it is looking
	 * straight past. Anything the server pins to a field still goes to `errors`
	 * and appears under the input; this is for the rest.
	 */
	const emailError = ref<string | null>(null);

	/**
	 * Whether Confirm is allowed to do anything.
	 *
	 * The same shape as `profileDirty` above and for the same reason: a button
	 * that cannot succeed should look like it. Empty counts as not valid, so the
	 * dialog opens with Confirm greyed rather than live over an empty field.
	 */
	const newEmailValid = computed(() => isValidEmail(newEmail.value));

	const pendingDelete = computed(() =>
		data.value?.gdprRequests.find(r => r.kind === "delete" && r.status === "pending") ?? null);

	/**
	 * Whether the profile form holds anything not yet saved.
	 *
	 * Compared against `data` rather than tracked with a flag on every input:
	 * a flag says "somebody typed", which stays true after they type a letter
	 * and delete it again, and would leave Save lit for a form that matches
	 * what is already stored. This asks the only question worth asking — is
	 * what is on screen different from what the server has.
	 */
	const profileDirty = computed(() =>
		profile.firstName !== (data.value?.profile.firstName ?? "")
		|| profile.lastName !== (data.value?.profile.lastName ?? ""));

	/**
	 * The same question for the handle, and the same answer: is what is on
	 * screen different from what the server has.
	 *
	 * Worth having here more than on the profile form. Changing a link is rate
	 * limited to once a month, so a Change that fires on the value already
	 * stored does not merely do nothing — it spends the cooldown on a no-op.
	 */
	const slugDirty = computed(() => slug.value !== (data.value?.profile.slug ?? ""));

	/** Puts the form back to what is stored. The Cancel next to Save. */
	function resetProfile() {
		profile.firstName = data.value?.profile.firstName ?? "";
		profile.lastName = data.value?.profile.lastName ?? "";
		errors.value = {};
	}

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


	/** Clears the dialog's field so it never reopens holding the last attempt. */
	function openEmailDialog() {
		newEmail.value = "";
		errors.value = {};
		emailError.value = null;
		emailDialogOpen.value = true;
	}

	function closeEmailDialog() {
		emailDialogOpen.value = false;
	}

	/**
	 * Checks the address when focus leaves the field.
	 *
	 * On blur rather than on Confirm, so the dialog has already told you the
	 * address is wrong by the time you reach for the button — a form that waits
	 * for a submit to say what it could have said a second earlier spends one of
	 * your clicks telling you something it already knew.
	 *
	 * An empty field is not an error. Leaving a box you never filled in is how
	 * somebody cancels; only the submit treats blank as a failure, and by then
	 * it is a real one.
	 */
	function validateNewEmail() {
		if (!newEmail.value.trim()) {
			errors.value.email = undefined;
			return;
		}
		errors.value.email = isValidEmail(newEmail.value) ? undefined : "Invalid email";
	}

	/**
	 * Asks for a confirmation link to be sent to a new address.
	 *
	 * Changes nothing on its own — the account moves when the link in that mail
	 * is clicked — so the banner says what was sent rather than what changed.
	 * The dialog stays open when the address is refused, because a rejected
	 * address is something to correct in the field it was typed in.
	 */
	const requestEmailChange = () => run("email", async () => {
		emailError.value = null;

		// The backstop. The disabled Confirm is the real guard now — and it also
		// closes the Enter-key path, since a browser will not implicitly submit
		// a form whose submit button is disabled — so nothing in the UI should
		// reach this. It stays because "no path reaches this" is a claim about
		// today's markup, and the cost of being wrong is a request that spends
		// one of five throttle entries an hour on a typo.
		//
		// `isValidEmail` is the same function the route calls; see
		// shared/utils/email.ts. It is a courtesy rather than a control: it
		// saves a round trip and, more usefully, an entry in a throttle that
		// allows five requests an hour, so a typo does not cost a real attempt.
		if (!isValidEmail(newEmail.value)) {
			errors.value.email = "Invalid email";
			return;
		}

		try {
			const result = await $fetch<{ pending: string }>("/api/affiliate/email", {
				method: "POST",
				body: { email: newEmail.value },
			});

			emailDialogOpen.value = false;
			newEmail.value = "";
			banner.value = {
				variant: "success",
				text: `Confirmation email sent to ${result.pending}. Your address changes when you open the link in it.`,
			};
			await refresh();
		}
		catch (error) {
			// Not `handle()`: its fallback is the page-level banner, which is
			// under the dialog this was submitted from. Field errors take the
			// same path as everywhere else; everything else stays in here.
			const payload = (error as { data?: { data?: { field?: string; message?: string }; statusMessage?: string } })?.data;
			const field = payload?.data?.field;
			const message = payload?.data?.message ?? payload?.statusMessage ?? "Could not start that change.";

			if (field) errors.value[field] = message;
			else emailError.value = message;
		}
	});

	const cancelEmailChange = () => run("email", async () => {
		try {
			await $fetch("/api/affiliate/email", { method: "DELETE" });
			banner.value = { variant: "success", text: "Email change cancelled. That link no longer works." };
			await refresh();
		}
		catch (error) { handle(error, "Could not cancel that change."); }
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

	/**
	 * The reasons offered when somebody asks to go.
	 *
	 * Kept short and mundane on purpose — the point is to be quick to answer on
	 * the way out, not to run a survey. `other` is last and is the one that
	 * turns the note field into the thing worth reading.
	 */
	const DELETE_REASONS = [
		{ value: "not_using", label: "I'm not using it any more" },
		{ value: "not_earning", label: "I'm not earning enough from it" },
		{ value: "too_complicated", label: "It's harder to use than I expected" },
		{ value: "switching", label: "I'm moving to something else" },
		{ value: "privacy", label: "I don't want my data held" },
		{ value: "temporary", label: "I'll be back — just not right now" },
		{ value: "other", label: "Something else" },
	];

	const deleteDialogOpen = ref(false);
	const deleteReason = ref("not_using");
	const deleteNote = ref("");

	function openDeleteDialog() {
		deleteReason.value = "not_using";
		deleteNote.value = "";
		errors.value = {};
		deleteDialogOpen.value = true;
	}

	const closeDeleteDialog = () => { deleteDialogOpen.value = false; };

	const gdpr = (action: "delete" | "cancel") => run("gdpr", async () => {
		try {
			await $fetch("/api/affiliate/gdpr", {
				method: "POST",
				body: action === "delete"
					? { action, reason: deleteReason.value, reasonNote: deleteNote.value }
					: { action },
			});
			deleteDialogOpen.value = false;
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

	/**
	 * Submitting the dialog. The confirming is the dialog itself now — it was a
	 * `window.confirm`, which is the wrong control for a decision with a reason
	 * attached to it, and the wrong one for a decision this size either way.
	 */
	const requestDelete = () => gdpr("delete");

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

	/**
	 * How long is left on something that expires.
	 *
	 * The mirror of `formatWhen`, and it exists because that one cannot do this:
	 * it subtracts from `Date.now()` and formats the result as "ago", so a
	 * timestamp in the future comes out as a negative number of minutes ago. The
	 * only thing here that looks forward is a confirmation link, which lives for
	 * a day — so the units that matter are hours and minutes, and a date is the
	 * fallback for a clock that has drifted rather than the normal case.
	 */
	const formatUntil = (iso: string) => {
		const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
		if (minutes <= 0) return "shortly";
		if (minutes < 60) return `in ${minutes}m`;
		const hours = Math.round(minutes / 60);
		if (hours < 48) return `in ${hours}h`;
		return `on ${formatDate(iso)}`;
	};

	const describeAction = (action: string) => ACTION_LABELS[action] ?? action;

	return {
		data, banner, busy, errors,
		profile, slug, pendingDelete,
		profileDirty, slugDirty, resetProfile,
		emailDialogOpen, newEmail, emailError, newEmailValid,
		openEmailDialog, closeEmailDialog, validateNewEmail, requestEmailChange, cancelEmailChange,
		saveProfile, saveSlug,
		signOutOthers, gdpr, requestDelete,
		DELETE_REASONS, deleteDialogOpen, deleteReason, deleteNote,
		openDeleteDialog, closeDeleteDialog,
		formatDate, formatWhen, formatUntil, describeAction,
	};
}
