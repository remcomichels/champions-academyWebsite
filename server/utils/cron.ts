import { timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";

/**
 * The guard on every scheduled route.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on each invocation,
 * so the secret never appears in vercel.json or in a schedule anybody can
 * read. Extracted from the deletion purge when the HeroFX sync became the
 * second job: one copy of an authentication check is one place to get it
 * right, and the second copy is where the constant-time comparison quietly
 * turns into `===`.
 *
 * `what` names the job in the 503, because "not configured" is otherwise
 * indistinguishable between two jobs in a cron log.
 */
export function requireCronSecret(event: H3Event, what: string): void {
	const secret = useRuntimeConfig().cronSecret as string;

	if (!secret) {
		// Failing closed. An unauthenticated endpoint that erases accounts or
		// rewrites the dashboard's figures is not something to leave open
		// because a variable is missing.
		throw createError({ statusCode: 503, statusMessage: `${what} is not configured` });
	}

	const sent = Buffer.from(getRequestHeader(event, "authorization") ?? "");
	const expected = Buffer.from(`Bearer ${secret}`);

	// Length first: timingSafeEqual throws on a mismatch, and that throw leaks
	// the length of the secret and nothing else.
	if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) {
		throw createError({ statusCode: 401, statusMessage: "Not authorised" });
	}
}
