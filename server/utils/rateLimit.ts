import { createHash } from "node:crypto";
import type { H3Event } from "h3";

/**
 * Rate limiting, backed by Postgres.
 *
 * An in-memory counter bounds nothing on serverless — each invocation can get
 * its own process — so the state has to be shared. `rl_hit` does the whole
 * check-and-increment in one statement so two concurrent attempts cannot both
 * see "one under the limit".
 */

export interface RateLimitRule {
	/** Attempts permitted inside the window. */
	limit: number;
	/** Window length in seconds. */
	windowSeconds: number;
	/** How long to lock the bucket once the limit is exceeded, in seconds. */
	lockSeconds: number;
}

export const RATE_LIMITS = {
	/** Login attempts from one IP. */
	loginIp: { limit: 10, windowSeconds: 900, lockSeconds: 1800 },
	/**
	 * Failed logins against one account. Counts failures only and is cleared on
	 * success, so someone else cannot lock you out by guessing at your address,
	 * and the lock is short for the same reason.
	 */
	loginUser: { limit: 5, windowSeconds: 900, lockSeconds: 900 },
	/** Invite redemption attempts from one IP. */
	otpIp: { limit: 10, windowSeconds: 900, lockSeconds: 3600 },
	/**
	 * Feedback from one affiliate. Generous, because sending three things in a
	 * row after finding three problems is the behaviour this feature wants —
	 * it exists to stop a script filling the table, not to ration opinions.
	 */
	feedback: { limit: 12, windowSeconds: 3600, lockSeconds: 900 },
	/**
	 * Global ceiling on redemption attempts. A per-code bucket is impossible —
	 * a hash miss does not say which invite was targeted — and would let an
	 * attacker lock a specific affiliate out of their own code.
	 */
	otpGlobal: { limit: 100, windowSeconds: 3600, lockSeconds: 900 },
	/**
	 * Password reset requests from one IP.
	 *
	 * Mirrors loginIp: the two are the same shape of abuse from the same
	 * direction, and someone working through a list of addresses is the case
	 * both exist to blunt.
	 */
	resetIp: { limit: 10, windowSeconds: 900, lockSeconds: 1800 },
	/**
	 * Password reset requests for one account, cleared on a completed reset.
	 *
	 * Deliberately loose. A tight bucket here is a way to lock somebody out of
	 * their *own* recovery — burn their allowance from anywhere and the real
	 * owner cannot get a link — which is the same trap otpGlobal exists to
	 * avoid, in a place where the victim has no other way in. Five an hour is
	 * enough to survive a mail that lands slowly and be re-tried, and still
	 * caps how much mail one address can be sent.
	 */
	resetUser: { limit: 5, windowSeconds: 3600, lockSeconds: 3600 },
	/**
	 * Confirmation-link attempts from one IP, on the email-change route.
	 *
	 * Its own budget rather than a share of `resetIp`, even though both are
	 * "somebody is guessing at tokens". Spending one allowance across the two
	 * would mean a burst against the email confirmer locking a real affiliate
	 * out of a password reset — and being unable to recover an account is a
	 * worse failure than being unable to change an address.
	 */
	emailChangeIp: { limit: 10, windowSeconds: 900, lockSeconds: 1800 },
	/**
	 * Email-change requests from one account.
	 *
	 * Keyed on the user rather than the address, because this route requires a
	 * session — so the identity is known, and an address bucket would be keyed
	 * on a value the caller chooses. Five an hour covers a typo, a correction
	 * and a re-send, and caps how much mail one signed-in account can aim at
	 * inboxes that are not theirs.
	 */
	emailChangeUser: { limit: 5, windowSeconds: 3600, lockSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

/** Hashes identifying values into bucket keys so the table holds no PII. */
function bucketKey(prefix: string, value: string): string {
	return `${prefix}:${createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 32)}`;
}

export const loginIpBucket = (ip: string) => bucketKey("login:ip", ip);
export const loginUserBucket = (email: string) => bucketKey("login:user", email);
export const otpIpBucket = (ip: string) => bucketKey("otp:ip", ip);
// Keyed on the affiliate rather than an address: the route requires a session,
// so this is the identity that actually matters, and an IP bucket would put a
// whole office behind one person's throttle.
export const feedbackBucket = (affiliateId: string) => bucketKey("feedback:aff", affiliateId);
export const resetIpBucket = (ip: string) => bucketKey("reset:ip", ip);
export const resetUserBucket = (email: string) => bucketKey("reset:user", email);
export const emailChangeIpBucket = (ip: string) => bucketKey("emailchange:ip", ip);
// The user id, not the address they typed: the route is authenticated, so this
// is throttling a known account rather than a value from the request body.
export const emailChangeUserBucket = (userId: string) => bucketKey("emailchange:user", userId);
export const OTP_GLOBAL_BUCKET = "otp:global";

/**
 * Records an attempt. Throws 429 with `Retry-After` when the bucket is locked.
 *
 * If the database is unreachable this **throws** rather than failing open —
 * an unthrottled login endpoint is worse than a briefly unavailable one.
 */
export async function enforceRateLimit(
	event: H3Event,
	bucket: string,
	rule: RateLimitRule,
): Promise<void> {
	const { data, error } = await db().rpc("rl_hit", {
		p_bucket: bucket,
		p_limit: rule.limit,
		p_window: `${rule.windowSeconds} seconds`,
		p_lock: `${rule.lockSeconds} seconds`,
	});

	if (error) {
		throw createError({ statusCode: 503, statusMessage: "Rate limiter unavailable" });
	}

	const row = Array.isArray(data) ? data[0] : data;
	if (row && row.allowed === false) {
		const retryAfter = Number(row.retry_after) || rule.lockSeconds;
		// h3 types Retry-After as a number, not a string.
		setResponseHeader(event, "retry-after", retryAfter);

		// Logged here rather than in each handler, because a throttled request
		// throws before it reaches them. Without this, a sustained brute force
		// would show only its first few attempts in the audit trail and then go
		// quiet exactly as it got interesting. The bucket is already hashed, so
		// this records no email or IP beyond the request's own.
		await audit(event, {
			actorKind: "system",
			action: "ratelimit.locked",
			meta: { bucket, retryAfter },
		});

		throw createError({
			statusCode: 429,
			statusMessage: "Too many attempts. Try again later.",
			data: { retryAfter },
		});
	}
}

/** Clears a bucket after a success, so honest typos don't accumulate. */
export async function resetRateLimit(bucket: string): Promise<void> {
	await db().rpc("rl_reset", { p_bucket: bucket });
}
