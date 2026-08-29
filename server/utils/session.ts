import { randomBytes, createHash } from "node:crypto";
import type { H3Event } from "h3";

/**
 * Opaque server-minted sessions.
 *
 * The browser holds a random token and nothing else. Deliberately not a JWT:
 *
 *  - Revocation is a stated requirement. Deleting the row ends the session on
 *    the next request; a JWT stays valid until it expires no matter what.
 *  - The cookie is httpOnly, so XSS anywhere on the marketing site has no
 *    bearer token to steal.
 *  - No refresh-token rotation, and no round-trip to an auth server per
 *    request — verification is one indexed read we are making anyway.
 */

/**
 * `__Host-` binds the cookie to this exact host with no Domain attribute, so a
 * subdomain can neither read nor overwrite it. Requires Secure and Path=/,
 * which is why login must be tested over HTTPS.
 */
export const SESSION_COOKIE = "__Host-ca_sess";

/** Hard ceiling. Never extended — a stolen token cannot live forever. */
const ABSOLUTE_LIFETIME_DAYS = 30;
/** Sliding idle window, refreshed on use. */
const IDLE_LIFETIME_DAYS = 7;
/** Only write `last_seen_at` when it has drifted this far, to avoid a write per request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface SessionUser {
	userId: string;
	sessionId: string;
	/**
	 * Set while an admin is viewing an affiliate's dashboard. Server-side state
	 * on the session row, never anything the request carried — see the migration
	 * 20260826000010 and the boundary note in auth.ts.
	 */
	impersonatingAffiliateId: string | null;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const daysFromNow = (days: number) =>
	new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

/**
 * Issues a session and sets the cookie.
 *
 * 32 bytes from the CSPRNG — the token is the credential, so it has to be
 * unguessable rather than merely unique. Only its hash is stored, so a
 * database leak does not hand over live sessions.
 */
export async function createSession(event: H3Event, userId: string): Promise<string> {
	const token = randomBytes(32).toString("base64url");

	const { error } = await db().from("sessions").insert({
		user_id: userId,
		token_hash: hashToken(token),
		absolute_expires_at: daysFromNow(ABSOLUTE_LIFETIME_DAYS),
		idle_expires_at: daysFromNow(IDLE_LIFETIME_DAYS),
		user_agent: getRequestHeader(event, "user-agent")?.slice(0, 500) ?? null,
		ip: clientIp(event),
	});

	if (error) {
		throw createError({ statusCode: 500, statusMessage: "Could not create session" });
	}

	setCookie(event, SESSION_COOKIE, token, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: ABSOLUTE_LIFETIME_DAYS * 24 * 60 * 60,
	});

	return token;
}

/**
 * Resolves the current session, or null.
 *
 * Named `getAuthSession` rather than `getSession` on purpose: server/utils is
 * auto-imported, and `getSession` would silently shadow h3's own function of
 * that name everywhere in the server bundle.
 *
 * Never throws on a bad token — callers decide whether absence is a 401 or
 * just "logged out". Expiry is evaluated in the query so a stale row can never
 * authenticate, even if the sweep has not run.
 */
export async function getAuthSession(event: H3Event): Promise<SessionUser | null> {
	const token = getCookie(event, SESSION_COOKIE);
	if (!token) return null;

	const nowIso = new Date().toISOString();

	const { data, error } = await db()
		.from("sessions")
		.select("id, user_id, last_seen_at, impersonating_affiliate_id")
		.eq("token_hash", hashToken(token))
		.is("revoked_at", null)
		.gt("absolute_expires_at", nowIso)
		.gt("idle_expires_at", nowIso)
		.maybeSingle();

	if (error || !data) return null;

	// Slide the idle window, but not on every single request.
	const lastSeen = new Date(data.last_seen_at as string).getTime();
	if (Date.now() - lastSeen > TOUCH_INTERVAL_MS) {
		await db()
			.from("sessions")
			.update({ last_seen_at: nowIso, idle_expires_at: daysFromNow(IDLE_LIFETIME_DAYS) })
			.eq("id", data.id);
	}

	return {
		userId: data.user_id as string,
		sessionId: data.id as string,
		impersonatingAffiliateId: data.impersonating_affiliate_id as string | null,
	};
}

/**
 * Starts or stops viewing an affiliate on this session.
 *
 * Scoped to the one session rather than the user: an admin who opens someone
 * else's dashboard on a laptop has not put their phone into that state too.
 */
export async function setImpersonation(sessionId: string, affiliateId: string | null): Promise<void> {
	await db()
		.from("sessions")
		.update({
			impersonating_affiliate_id: affiliateId,
			impersonation_started_at: affiliateId ? new Date().toISOString() : null,
		})
		.eq("id", sessionId);
}

/** Ends the current session and clears the cookie. */
export async function destroySession(event: H3Event): Promise<void> {
	const token = getCookie(event, SESSION_COOKIE);

	if (token) {
		// Deleted, not flagged: there is nothing here worth keeping, and a row
		// that cannot be selected cannot be accidentally honoured.
		await db().from("sessions").delete().eq("token_hash", hashToken(token));
	}

	deleteCookie(event, SESSION_COOKIE, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
	});
}

/**
 * Ends every session for a user.
 *
 * This is what makes "revoke access" immediate rather than eventually
 * consistent — used by the admin revoke route and by "sign out everywhere".
 */
export async function destroyAllSessions(userId: string): Promise<void> {
	await db().from("sessions").delete().eq("user_id", userId);
}
