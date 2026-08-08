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
	 * Global ceiling on redemption attempts. A per-code bucket is impossible —
	 * a hash miss does not say which invite was targeted — and would let an
	 * attacker lock a specific affiliate out of their own code.
	 */
	otpGlobal: { limit: 100, windowSeconds: 3600, lockSeconds: 900 },
} as const satisfies Record<string, RateLimitRule>;

/** Hashes identifying values into bucket keys so the table holds no PII. */
function bucketKey(prefix: string, value: string): string {
	return `${prefix}:${createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 32)}`;
}

export const loginIpBucket = (ip: string) => bucketKey("login:ip", ip);
export const loginUserBucket = (email: string) => bucketKey("login:user", email);
export const otpIpBucket = (ip: string) => bucketKey("otp:ip", ip);
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
