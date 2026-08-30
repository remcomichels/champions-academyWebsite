import { timingSafeEqual } from "node:crypto";

/**
 * Carries out deletion requests whose grace period has run out.
 *
 * Run once a day by Vercel Cron — see the `crons` entry in vercel.json, which
 * is why this is a GET: cron invokes the path with one. Nothing else calls it,
 * and nothing about it is reachable from the dashboard. It is not
 * `requireAdmin`, because the caller is not a person, and it takes no id,
 * because the only thing it acts on is a request the affiliate themselves made
 * fourteen days ago.
 *
 * ── Why Vercel Cron and not a scheduled workflow ────────────────────────────
 * The first version of this was a GitHub Action, and it had one flaw that
 * disqualified it: GitHub disables scheduled workflows in a repository with no
 * commits for 60 days. A quiet couple of months is entirely plausible on a
 * finished project, and what would stop is the job that keeps a deletion
 * deadline promised in writing. It would stop silently. Vercel's scheduler runs
 * as long as the project is deployed, which is the same condition under which
 * anybody can ask to be deleted in the first place.
 *
 * ── Authentication ──────────────────────────────────────────────────────────
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on every cron invocation,
 * so the secret never appears in vercel.json or in a schedule anybody can read.
 * Compared in constant time. If it is unset the route answers 503 rather than
 * running unauthenticated: an endpoint that erases accounts is the last place
 * to fail open.
 *
 * ── Why it is safe to run at any time ───────────────────────────────────────
 * It selects only rows past `execute_after`, and `purgeAffiliate` is idempotent,
 * so running it twice in a minute does nothing the first run did not. Each
 * request is handled on its own and a failure on one is recorded and stepped
 * over, because one affiliate whose purge throws must not hold up everybody
 * else's — including people whose fourteen days ran out earlier.
 */
export default defineEventHandler(async (event) => {
	const secret = useRuntimeConfig().cronSecret as string;

	if (!secret) {
		throw createError({ statusCode: 503, statusMessage: "Purge is not configured" });
	}

	const a = Buffer.from(getRequestHeader(event, "authorization") ?? "");
	const b = Buffer.from(`Bearer ${secret}`);

	// Length is compared first because timingSafeEqual throws on a mismatch;
	// that leaks the length of the secret and nothing else.
	if (a.length !== b.length || !timingSafeEqual(a, b)) {
		throw createError({ statusCode: 401, statusMessage: "Not authorised" });
	}

	const { data: due, error } = await db()
		.from("gdpr_requests")
		.select("id, affiliate_id, execute_after")
		.eq("kind", "delete")
		.in("status", ["pending", "ready"])
		.lte("execute_after", new Date().toISOString());

	if (error) {
		throw createError({ statusCode: 500, statusMessage: "Could not read the deletion queue" });
	}

	const purged: string[] = [];
	const failed: { id: string; error: string }[] = [];

	for (const row of due ?? []) {
		const requestId = row.id as string;
		const affiliateId = row.affiliate_id as string;

		try {
			await purgeAffiliate(affiliateId);

			await db().from("gdpr_requests")
				.update({ status: "done", completed_at: new Date().toISOString() })
				.eq("id", requestId);

			// Logged as the system, and with no affiliate attached: the row this
			// would point at has just been emptied, and naming it would put the
			// id of an erased account back into the trail.
			await audit(event, {
				actorKind: "system",
				action: "gdpr.delete_executed",
				meta: { requestId },
			});

			purged.push(requestId);
		}
		catch (cause) {
			const message = cause instanceof Error ? cause.message : "unknown";

			// Left `pending` on purpose. A failed purge has to be retried
			// tomorrow rather than marked done, and the affiliate is still owed
			// the erasure — so the only thing recorded here is that it did not
			// happen.
			console.error(`[purge] request ${requestId} failed:`, message);

			await audit(event, {
				actorKind: "system",
				action: "gdpr.delete_failed",
				meta: { requestId, error: message.slice(0, 200) },
			});

			failed.push({ id: requestId, error: message.slice(0, 200) });
		}
	}

	// A non-2xx when anything failed, so the run is recorded as failed in the
	// project's cron log rather than reporting a clean pass that erased nobody.
	if (failed.length) {
		throw createError({
			statusCode: 500,
			statusMessage: `${failed.length} of ${(due ?? []).length} deletions failed`,
			data: { purged: purged.length, failed },
		});
	}

	return { due: (due ?? []).length, purged: purged.length };
});
