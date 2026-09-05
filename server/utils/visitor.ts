import { createHash } from "node:crypto";
import type { H3Event } from "h3";

/** The UTC day a visit is counted against. Matches `referral_visits.day`. */
export function visitDay(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * The pseudonymous visitor fingerprint.
 *
 * sha256(VISIT_PEPPER || ip || user agent || day). One-way and rotating daily,
 * so it identifies a visitor for exactly as long as the dedupe needs and no
 * longer. No IP or user agent is ever stored — this hash is the only thing that
 * reaches the database, which is what the privacy policy describes.
 *
 * Extracted here because three call sites now need the identical recipe and
 * they must not drift: the same visitor has to produce the same hash in the
 * referral middleware and at the redirect, or the unique indexes stop deduping
 * and every figure built on them doubles.
 */
export function visitorHash(event: H3Event, day: string = visitDay()): string {
	const pepper = useRuntimeConfig().visitPepper as string;

	return createHash("sha256")
		.update(`${pepper}|${clientIp(event)}|${getRequestHeader(event, "user-agent") ?? ""}|${day}`)
		.digest("hex");
}
