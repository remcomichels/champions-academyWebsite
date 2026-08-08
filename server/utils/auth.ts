import type { H3Event } from "h3";
import type { AffiliateStatus } from "#shared/types/affiliate";

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

/** The signed-in user, or throws 401. */
export async function requireUser(event: H3Event): Promise<{ userId: string; sessionId: string }> {
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
export async function requireAdmin(event: H3Event): Promise<{ userId: string; sessionId: string }> {
	const session = await requireUser(event);

	if (!(await isAdmin(session.userId))) {
		// 404, not 403: whether an admin API exists is not something to confirm
		// to a signed-in affiliate poking at URLs.
		throw createError({ statusCode: 404, statusMessage: "Not found" });
	}

	return session;
}

/**
 * Requires an active affiliate session and returns their row.
 *
 * The returned `id` is the only affiliate identifier any affiliate-scoped
 * query may use.
 *
 * A paused or revoked affiliate is refused here rather than filtered later, so
 * revocation takes effect on the very next request.
 */
export async function requireAffiliate(event: H3Event): Promise<AffiliateRow> {
	const session = await requireUser(event);

	const { data, error } = await db()
		.from("affiliates")
		.select(AFFILIATE_COLUMNS)
		.eq("user_id", session.userId)
		.maybeSingle();

	if (error) {
		throw createError({ statusCode: 500, statusMessage: "Could not load affiliate" });
	}

	if (!data) {
		// Authenticated, but no affiliate attached — an admin-only account.
		throw createError({ statusCode: 403, statusMessage: "No affiliate account" });
	}

	const affiliate = data as unknown as AffiliateRow;

	if (affiliate.status !== "active") {
		// Destroy the session too: leaving it alive means every subsequent
		// request pays a database round-trip to be told no.
		await destroyAllSessions(session.userId);
		throw createError({ statusCode: 403, statusMessage: "Account is not active" });
	}

	return affiliate;
}
