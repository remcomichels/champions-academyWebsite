import { randomBytes, createHmac } from "node:crypto";
import type { H3Event } from "h3";

/**
 * Password reset tokens.
 *
 * Same shape as the invite codes in otp.ts — a full-entropy random secret,
 * stored only as a peppered HMAC — but with none of the human-readability.
 * Nobody types this one: it arrives as a link, so it is 32 raw bytes rather
 * than Crockford Base32, and there is no normalisation step to get wrong.
 *
 * Why not Supabase's own recovery flow: it hands the browser a Supabase
 * session and needs the Supabase JS client running in the page to catch it.
 * Supabase is server-side only in this project and session.ts exists so the
 * browser never holds a JWT. See the migration for the longer note.
 */

/**
 * One hour.
 *
 * The window *is* the risk: for as long as this link lives, anyone who can
 * read the mailbox owns the account. An hour is long enough to walk to another
 * device and short enough that a message sitting in a shared or forwarded
 * inbox stops being a key by the time anyone stumbles on it.
 */
const LIFETIME_MINUTES = 60;

/**
 * Hashes a token for storage and lookup.
 *
 * HMAC-SHA256 under OTP_PEPPER, the same pepper the invite codes use, with a
 * `pwreset:` prefix so the two are domain-separated: a value lifted from one
 * table can never be made to validate against the other, even though they
 * share a key.
 *
 * Not a slow KDF, for the reason given in otp.ts — this is a 256-bit machine
 * secret, not a password, so stretching buys nothing and would cost the single
 * indexed lookup.
 */
function hashResetToken(token: string): string {
	const pepper = useRuntimeConfig().otpPepper as string;

	if (!pepper) {
		// Fail closed. Without a pepper this degrades to a bare SHA-256 an
		// attacker could precompute against a stolen table.
		throw createError({ statusCode: 500, statusMessage: "OTP_PEPPER is not configured" });
	}

	return createHmac("sha256", pepper).update(`pwreset:${token}`).digest("hex");
}

/**
 * Mints a reset token for a user and returns the raw value — the only moment
 * it exists in plaintext. It goes straight into the email and is never logged,
 * audited or returned to the caller of the API.
 *
 * Any previous rows for the user are deleted first, so issuing a new link
 * kills the old one. That matters: someone who requests a second reset because
 * the first mail went astray has, in effect, said the first link should not
 * work any more.
 */
export async function issueResetToken(event: H3Event, userId: string): Promise<string> {
	const token = randomBytes(32).toString("base64url");

	// Supersede rather than accumulate. Also serves as the purge for this
	// user's expired rows, so the table stays small without a cron job.
	await db().from("password_resets").delete().eq("user_id", userId);

	const { error } = await db().from("password_resets").insert({
		user_id: userId,
		token_hash: hashResetToken(token),
		expires_at: new Date(Date.now() + LIFETIME_MINUTES * 60 * 1000).toISOString(),
		requested_ip: clientIp(event),
		requested_ua: getRequestHeader(event, "user-agent")?.slice(0, 500) ?? null,
	});

	if (error) {
		throw createError({ statusCode: 500, statusMessage: "Could not start a password reset" });
	}

	return token;
}

/**
 * Redeems a token, returning the user it belongs to — or null if it is
 * unknown, already used, or expired. The caller cannot tell those three apart,
 * which is deliberate.
 *
 * The claim is a single conditional UPDATE rather than a read followed by a
 * write. Two requests arriving with the same token race on one row, and only
 * the one that flips `used_at` from null gets a row back — so a link cannot
 * change a password twice, however the two requests interleave.
 */
export async function consumeResetToken(token: string): Promise<string | null> {
	const { data, error } = await db()
		.from("password_resets")
		.update({ used_at: new Date().toISOString() })
		.eq("token_hash", hashResetToken(token))
		.is("used_at", null)
		.gt("expires_at", new Date().toISOString())
		.select("user_id")
		.maybeSingle();

	if (error || !data) return null;

	return data.user_id as string;
}
