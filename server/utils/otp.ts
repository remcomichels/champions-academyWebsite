import { randomBytes, createHmac } from "node:crypto";

/**
 * One-time invite codes.
 *
 * The owner generates a code in the admin panel and hands it over out of band
 * (Telegram, a call). Redeeming it is how an affiliate creates their account —
 * there is no public sign-up.
 *
 * Zero new dependencies: this is all node:crypto.
 */

/**
 * Crockford Base32 — no I, L, O or U.
 *
 * I/L/O are omitted because they are indistinguishable from 1/0 when read
 * aloud or typed from a screenshot; U is omitted because it turns up in
 * unfortunate words by accident.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Symbols in the code body. 12 x 5 bits = 60 bits of entropy. */
const CODE_LENGTH = 12;

export interface GeneratedCode {
	/** The full human-facing code, e.g. "CA-4T9K-M2XR-7BQN". Shown once. */
	code: string;
	/** First group, e.g. "4T9K" — stored so the owner can tell invites apart. */
	prefix: string;
}

/**
 * Generates a code.
 *
 * `byte & 31` is uniform because 32 divides 256 exactly — no modulo bias and
 * no rejection sampling needed.
 */
export function generateInviteCode(): GeneratedCode {
	const bytes = randomBytes(CODE_LENGTH);
	const chars = Array.from(bytes, byte => ALPHABET[byte & 31]).join("");
	const groups = chars.match(/.{4}/g)!;

	return { code: `CA-${groups.join("-")}`, prefix: groups[0]! };
}

/**
 * Canonicalises whatever the affiliate typed.
 *
 * Handles the ways a code gets mangled between a chat message and a form:
 * lower case, missing or extra dashes, spaces, a dropped "CA-" prefix, and
 * Crockford's I/L -> 1 and O -> 0 confusions.
 *
 * Takes the **last** 12 symbols rather than stripping a leading "CA", because
 * C and A are both in the alphabet — a code whose body happens to start "CA"
 * would otherwise normalise differently depending on whether the prefix was
 * typed.
 *
 * Returns null when the input cannot be a code, so callers can fail fast
 * without a database round-trip.
 */
export function normalizeInviteCode(input: string): string | null {
	const cleaned = input
		.toUpperCase()
		.replace(/[^0-9A-Z]/g, "")
		.replace(/[IL]/g, "1")
		.replace(/O/g, "0");

	if (cleaned.length < CODE_LENGTH) return null;

	return cleaned.slice(-CODE_LENGTH);
}

/**
 * Hashes a normalised code for storage and lookup.
 *
 * HMAC-SHA256, deliberately not bcrypt/scrypt and not bare SHA-256:
 *
 *  - Not a slow KDF. This is a full-entropy machine-generated secret, not a
 *    human password, so key stretching buys nothing — and it would rule out
 *    the single indexed lookup that keeps invites non-enumerable.
 *  - Not bare SHA-256. 60 bits is within reach of an offline search given a
 *    known format. The pepper lives in the environment rather than the
 *    database, so a dump of the invites table on its own is inert.
 */
export function hashInviteCode(normalized: string): string {
	const pepper = useRuntimeConfig().otpPepper as string;

	if (!pepper) {
		// Failing closed matters here: without a pepper every hash would be a
		// plain SHA-256 an attacker could precompute.
		throw createError({ statusCode: 500, statusMessage: "OTP_PEPPER is not configured" });
	}

	return createHmac("sha256", pepper).update(normalized).digest("hex");
}
