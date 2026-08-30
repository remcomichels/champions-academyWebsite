import { randomBytes, createHmac } from "node:crypto";
import type { H3Event } from "h3";

/**
 * Email-change confirmation tokens.
 *
 * The twin of passwordReset.ts, and deliberately built the same way — 32 raw
 * bytes, stored only as a peppered HMAC, claimed with a single conditional
 * UPDATE. The differences are both in the migration's notes: this one carries
 * the address it is going to move to, and it lives for a day rather than an
 * hour, because it is delivered to the mailbox it is verifying rather than to
 * one that already owns the account.
 */

/** Twenty-four hours. See the migration for why it is not the reset link's one. */
const LIFETIME_HOURS = 24;

export interface PendingEmailChange {
	userId: string;
	newEmail: string;
}

/**
 * Hashes a token for storage and lookup.
 *
 * HMAC-SHA256 under OTP_PEPPER — the pepper the invite codes and reset links
 * already share — with an `emailchange:` prefix so the three are domain
 * separated: a value lifted from one table can never be made to validate
 * against another, even though they share a key.
 */
function hashChangeToken(token: string): string {
	const pepper = useRuntimeConfig().otpPepper as string;

	if (!pepper) {
		// Fail closed, exactly as the other two do. Without a pepper this
		// degrades to a bare SHA-256 an attacker could precompute against a
		// stolen table.
		throw createError({ statusCode: 500, statusMessage: "OTP_PEPPER is not configured" });
	}

	return createHmac("sha256", pepper).update(`emailchange:${token}`).digest("hex");
}

/**
 * Mints a confirmation token and returns the raw value — the only moment it
 * exists in plaintext. It goes straight into the email and is never logged,
 * audited or returned to the caller of the API.
 *
 * Any previous rows for the user are deleted first, so naming a second address
 * kills the link sent for the first. That is the behaviour someone who mistyped
 * an address expects: the wrong one should stop being confirmable the moment
 * they correct it.
 */
export async function issueEmailChangeToken(
	event: H3Event,
	userId: string,
	newEmail: string,
): Promise<string> {
	const token = randomBytes(32).toString("base64url");

	// Supersede rather than accumulate. Also serves as the purge for this
	// user's expired rows, so the table stays small without a cron job.
	await db().from("email_changes").delete().eq("user_id", userId);

	const { error } = await db().from("email_changes").insert({
		user_id: userId,
		new_email: newEmail,
		token_hash: hashChangeToken(token),
		expires_at: new Date(Date.now() + LIFETIME_HOURS * 60 * 60 * 1000).toISOString(),
		requested_ip: clientIp(event),
		requested_ua: getRequestHeader(event, "user-agent")?.slice(0, 500) ?? null,
	});

	if (error) {
		throw createError({ statusCode: 500, statusMessage: "Could not start an email change" });
	}

	return token;
}

/**
 * Redeems a token, returning the user and the address it was issued for — or
 * null if it is unknown, already used, or expired. The caller cannot tell those
 * three apart, which is deliberate.
 *
 * The claim is a single conditional UPDATE rather than a read followed by a
 * write, so two requests arriving with the same token race on one row and only
 * the one that flips `used_at` from null gets a row back.
 */
export async function consumeEmailChangeToken(token: string): Promise<PendingEmailChange | null> {
	const { data, error } = await db()
		.from("email_changes")
		.update({ used_at: new Date().toISOString() })
		.eq("token_hash", hashChangeToken(token))
		.is("used_at", null)
		.gt("expires_at", new Date().toISOString())
		.select("user_id, new_email")
		.maybeSingle();

	if (error || !data) return null;

	return { userId: data.user_id as string, newEmail: data.new_email as string };
}

/**
 * The change a user has asked for and not yet confirmed, if any.
 *
 * Read by the settings route so the sign-in row can say an address is waiting
 * rather than looking as though nothing happened. Expired and spent rows are
 * excluded — a link that can no longer be clicked is not pending.
 */
export async function pendingEmailChange(userId: string): Promise<{ email: string; expiresAt: string } | null> {
	const { data } = await db()
		.from("email_changes")
		.select("new_email, expires_at")
		.eq("user_id", userId)
		.is("used_at", null)
		.gt("expires_at", new Date().toISOString())
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!data) return null;

	return { email: data.new_email as string, expiresAt: data.expires_at as string };
}

/** Drops any pending request for a user. The Cancel next to the pending notice. */
export async function cancelEmailChange(userId: string): Promise<void> {
	await db().from("email_changes").delete().eq("user_id", userId);
}
