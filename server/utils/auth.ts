import type { H3Event } from "h3";
import type { AffiliateStatus } from "#shared/types/affiliate";
import type { SessionUser } from "./session";

/**
 * Authentication and authorisation guards.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS FILE IS THE ISOLATION BOUNDARY.
 *
 * An affiliate must only ever see their own figures. The way that is
 * guaranteed is: `requireAffiliate()` derives the affiliate from the session
 * cookie and returns the row, and every affiliate-scoped handler filters by
 * `affiliate.id` from that return value.
 *
 * No handler under `server/api/affiliate/` may read an affiliate id, slug, or
 * uuid from a query parameter, route parameter, or request body. There is a
 * grep in CI for exactly this. If you find yourself wanting to pass an id in,
 * the answer is no — that is the IDOR this design exists to prevent.
 *
 * Admin view-as does not change that. An admin looking at someone else's
 * dashboard is still `requireAffiliate()` returning a row the *session* points
 * at; the id lives on the session record, not in the request, so the affiliate
 * routes carry on knowing nothing about it and the grep still holds.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** The affiliate columns server code is allowed to work with. */
export interface AffiliateRow {
	id: string;
	slug: string;
	display_name: string;
	status: AffiliateStatus;
	whop_affiliate_id: string | null;
	whop_username: string | null;
	whop_checkout_configuration_id: string | null;
	vip_checkout_url: string | null;
	lite_telegram_url: string | null;
	calendly_url: string | null;
	user_id: string | null;
	avatar_path: string | null;
	timezone: string;
	locale: string;
	slug_changed_at: string | null;
	onboarding: Record<string, unknown>;
	notification_prefs: Record<string, unknown>;
	created_at: string;
}

const AFFILIATE_COLUMNS = `
	id, slug, display_name, status,
	whop_affiliate_id, whop_username, whop_checkout_configuration_id,
	vip_checkout_url, lite_telegram_url, calendly_url,
	user_id, avatar_path, timezone, locale, slug_changed_at,
	onboarding, notification_prefs, created_at
`;

const unauthorized = () =>
	createError({ statusCode: 401, statusMessage: "Not signed in" });

/**
 * The signed-in user, or throws 401.
 *
 * Returns the whole SessionUser rather than a narrowed shape: the view-as
 * target lives on it, and a hand-written return type here silently dropped it
 * from every caller.
 */
export async function requireUser(event: H3Event): Promise<SessionUser> {
	const session = await getAuthSession(event);
	if (!session) throw unauthorized();
	return session;
}

/** True when the signed-in user is an admin. Never derived from a client value. */
export async function isAdmin(userId: string): Promise<boolean> {
	const { data } = await db()
		.from("admin_users")
		.select("user_id")
		.eq("user_id", userId)
		.maybeSingle();

	return Boolean(data);
}

/**
 * Requires an admin session.
 *
 * Admin status lives in its own table rather than user metadata, because
 * metadata is writable by the user it describes.
 */
export async function requireAdmin(event: H3Event): Promise<SessionUser> {
	const session = await requireUser(event);

	if (!(await isAdmin(session.userId))) {
		// 404, not 403: whether an admin API exists is not something to confirm
		// to a signed-in affiliate poking at URLs.
		throw createError({ statusCode: 404, statusMessage: "Not found" });
	}

	return session;
}

/**
 * Resolves the affiliate a session is currently acting as, or null.
 *
 * Two ways in. Normally it is the affiliate attached to the signed-in user. If
 * the session is in view-as, and the user is *still* an admin, it is the
 * affiliate the session points at instead — re-checked on every request rather
 * than trusted from when it was set, so an admin who loses access mid-session
 * drops straight back to their own account.
 *
 * Returns the row without judging its status; callers decide what a non-active
 * one means, and that answer differs depending on who is asking.
 */
export async function resolveSessionAffiliate(
	session: { userId: string; impersonatingAffiliateId: string | null },
): Promise<{ affiliate: AffiliateRow | null; viewingAs: boolean }> {
	if (session.impersonatingAffiliateId && await isAdmin(session.userId)) {
		const { data } = await db()
			.from("affiliates")
			.select(AFFILIATE_COLUMNS)
			.eq("id", session.impersonatingAffiliateId)
			.maybeSingle();

		if (data) return { affiliate: data as unknown as AffiliateRow, viewingAs: true };
		// The affiliate was deleted while being viewed. Falling through to their
		// own account beats a dead dashboard.
	}

	const { data, error } = await db()
		.from("affiliates")
		.select(AFFILIATE_COLUMNS)
		.eq("user_id", session.userId)
		.maybeSingle();

	if (error) {
		throw createError({ statusCode: 500, statusMessage: "Could not load affiliate" });
	}

	return { affiliate: (data as unknown as AffiliateRow) ?? null, viewingAs: false };
}

/**
 * Requires an active affiliate session and returns their row.
 *
 * The returned `id` is the only affiliate identifier any affiliate-scoped
 * query may use.
 *
 * A revoked affiliate is refused here rather than filtered later, so revocation
 * takes effect on the very next request.
 */
export async function requireAffiliate(event: H3Event): Promise<AffiliateRow> {
	const session = await requireUser(event);
	const { affiliate, viewingAs } = await resolveSessionAffiliate(session);

	if (!affiliate) {
		// Authenticated, but no affiliate attached — an admin-only account.
		throw createError({ statusCode: 403, statusMessage: "No affiliate account" });
	}

	if (viewingAs) {
		// Read-only, enforced at the boundary rather than route by route, so a
		// route added later is covered without anyone remembering to.
		//
		// Without this an admin could change someone's password, rewrite their
		// links or request deletion of their data from inside their account, and
		// the audit trail would record the affiliate doing it.
		if (event.method !== "GET") {
			throw createError({
				statusCode: 403,
				statusMessage: "You're viewing this affiliate's dashboard — stop viewing to make changes",
			});
		}

		// Status is deliberately not checked. A revoked affiliate's dashboard is
		// one of the things an admin most needs to be able to open, and the
		// admin's own access is what authorises this, not the affiliate's.
		return affiliate;
	}

	if (affiliate.status !== "active") {
		// Destroy the session too: leaving it alive means every subsequent
		// request pays a database round-trip to be told no.
		await destroyAllSessions(session.userId);
		throw createError({ statusCode: 403, statusMessage: "Account is not active" });
	}

	return affiliate;
}

/**
 * Finds a user by email address.
 *
 * Supabase's admin API has no lookup by email — `listUsers` takes a page and a
 * size and nothing else — so this pages until it finds one. That is fine at the
 * scale this system runs at (users here are affiliates and admins, not
 * customers) and the cap stops it walking forever if that ever stops being
 * true. Returns null rather than throwing, so callers decide what a miss means.
 */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
	const target = email.toLowerCase().trim();
	const perPage = 200;
	const maxPages = 25;

	for (let page = 1; page <= maxPages; page++) {
		const { data, error } = await db().auth.admin.listUsers({ page, perPage });

		if (error) throw createError({ statusCode: 500, statusMessage: "Could not search accounts" });

		const users = data?.users ?? [];
		const match = users.find(user => user.email?.toLowerCase() === target);

		if (match?.email) return { id: match.id, email: match.email };
		if (users.length < perPage) return null;
	}

	return null;
}
