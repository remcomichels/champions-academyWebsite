import { computed, ref } from "vue";
import { useRequestHeaders } from "#imports";
import type { AdminAffiliate } from "./admin";

/**
 * The activity log.
 *
 * A thin client over /api/admin/audit, plus the translation from stored action
 * slugs into something readable. The slugs are a stable machine key — they are
 * matched on in queries and must not be reworded to suit a UI — so the wording
 * lives here instead, and an action this file has never heard of still renders
 * rather than vanishing.
 */

export interface AuditEntry {
	id: number;
	at: string;
	actorKind: string;
	action: string;
	affiliateSlug: string | null;
	ip: string | null;
	meta: Record<string, unknown>;
}

/** How a line should read: an outcome worth noticing, or just a record. */
export type AuditTone = "neutral" | "good" | "bad";

export interface DescribedEntry {
	text: string;
	tone: AuditTone;
}

const str = (meta: Record<string, unknown>, key: string): string | null => {
	const value = meta[key];
	return typeof value === "string" && value ? value : null;
};

const num = (meta: Record<string, unknown>, key: string): number | null => {
	const value = meta[key];
	return typeof value === "number" ? value : null;
};

/**
 * Turns one row into a sentence.
 *
 * The meta is the point. "Details edited" on its own tells you nothing you can
 * act on; "their link moved from ?r=a to ?r=b" names the thing that changed and
 * the thing that broke because of it.
 */
export function describeAudit(entry: AuditEntry): DescribedEntry {
	const m = entry.meta ?? {};
	const good = (text: string): DescribedEntry => ({ text, tone: "good" });
	const bad = (text: string): DescribedEntry => ({ text, tone: "bad" });
	const plain = (text: string): DescribedEntry => ({ text, tone: "neutral" });

	switch (entry.action) {
		// ── Admin acting on an affiliate ────────────────────────────────────
		case "affiliate.created":
			return good(`Created as ?r=${str(m, "slug") ?? "—"}`);

		case "affiliate.updated": {
			const from = str(m, "slugFrom");
			const to = str(m, "slugTo");
			if (from && to) return plain(`Details edited, and their link moved from ?r=${from} to ?r=${to}`);
			return plain(`Details edited — ${str(m, "fields") ?? "no fields recorded"}`);
		}

		case "affiliate.status_changed":
			return str(m, "status") === "active"
				? good("Access restored")
				: bad("Access revoked — signed out, and their link stopped swapping");

		// ── Invites ─────────────────────────────────────────────────────────
		case "invite.issued": {
			const days = num(m, "expiresInDays");
			return plain(`Invite code ${str(m, "prefix") ?? "—"}… issued${days ? `, good for ${days} days` : ""}`);
		}

		case "invite.revoked":
			return plain(`Invite code ${str(m, "prefix") ?? "—"}… revoked`);

		case "invite.redeemed":
			return good("Invite redeemed — their account exists from here on");

		case "invite.redeem_failed":
			return bad(`Invite redemption failed — ${str(m, "reason") ?? "no reason recorded"}`);

		// ── The affiliate acting on themselves ──────────────────────────────
		case "slug.changed":
			return plain(`Changed their own link from ?r=${str(m, "from") ?? "—"} to ?r=${str(m, "to") ?? "—"}`);

		case "links.updated": {
			const set = [m.lite === true && "Telegram", m.calendly === true && "Calendly"].filter(Boolean);
			return plain(set.length ? `Saved their links — ${set.join(" and ")} set` : "Cleared their links");
		}

		case "profile.updated":
			return plain("Updated their profile");

		case "password.changed":
			return good("Changed their password — other sessions ended");

		case "password.change_failed":
			return bad("Password change failed — the current password did not match");

		case "sessions.revoked_others":
			return plain("Signed out their other devices");

		// ── Sessions ────────────────────────────────────────────────────────
		case "auth.login":
			return plain("Signed in");

		case "auth.logout":
			return plain("Signed out");

		case "auth.login_failed":
			return bad("Failed sign-in attempt");

		case "ratelimit.locked": {
			const seconds = num(m, "retryAfter");
			return bad(`Rate limit hit — locked${seconds ? ` for ${Math.round(seconds / 60)} min` : ""}`);
		}

		// ── Admin access ────────────────────────────────────────────────────
		case "admin.granted":
			return good(`Granted admin access to ${str(m, "email") ?? "an account"}`);

		case "admin.revoked":
			return bad("Removed someone's admin access");

		// ── GDPR ────────────────────────────────────────────────────────────
		case "gdpr.exported":
			return plain("Exported their own data");

		case "gdpr.delete_requested":
			return bad("Requested deletion of their account");

		case "gdpr.cancelled":
			return plain(`Cancelled ${num(m, "count") ?? 0} pending data request(s)`);

		// An action added since this file was last touched. Showing the raw slug
		// beats showing nothing, and beats pretending it did not happen.
		default:
			return plain(entry.action);
	}
}

export function useAudit() {
	const entries = ref<AuditEntry[]>([]);
	const loading = ref(false);
	const error = ref<string | null>(null);

	/** Null means every affiliate, plus the rows that belong to none. */
	const affiliateId = ref<string | null>(null);
	const affiliates = ref<AdminAffiliate[]>([]);
	const affiliateSearch = ref("");

	const selected = computed(() =>
		affiliates.value.find(a => a.id === affiliateId.value) ?? null);

	const matchingAffiliates = computed(() => {
		const term = affiliateSearch.value.trim().toLowerCase();
		if (!term) return affiliates.value;
		return affiliates.value.filter(a =>
			a.slug.includes(term) || a.displayName.toLowerCase().includes(term));
	});

	async function load() {
		loading.value = true;
		error.value = null;

		try {
			const data = await $fetch<{ entries: AuditEntry[] }>("/api/admin/audit", {
				query: {
					limit: 200,
					// Omitted rather than sent as null: the route validates it as a
					// uuid when present, and "" is not one.
					...(affiliateId.value ? { affiliateId: affiliateId.value } : {}),
				},
				headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
			});
			entries.value = data.entries;
		}
		catch {
			error.value = "Could not load the activity log.";
		}
		finally {
			loading.value = false;
		}
	}

	/** The picker lists every affiliate, revoked ones included — those are
	 *  exactly the accounts whose history you go looking for. */
	async function loadAffiliates() {
		try {
			const data = await $fetch<{ affiliates: AdminAffiliate[] }>("/api/admin/affiliates", {
				headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
			});
			affiliates.value = data.affiliates;
		}
		catch {
			// The log is still readable unfiltered, so this is not worth an error
			// banner over the page.
		}
	}

	async function filterBy(id: string | null) {
		affiliateId.value = id;
		await load();
	}

	return {
		entries,
		loading,
		error,
		affiliateId,
		affiliates,
		affiliateSearch,
		matchingAffiliates,
		selected,
		load,
		loadAffiliates,
		filterBy,
	};
}
