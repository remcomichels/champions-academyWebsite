import type { Json } from "#server/types/supabase";

/**
 * Copies the HeroFX IB feed into our own tables.
 *
 * Run every few minutes by Vercel Cron — see the `crons` entry in vercel.json,
 * which is why this is a GET: cron invokes the path with one. Nothing else
 * calls it and nothing about it is reachable from the dashboard.
 *
 * ── Why a sync at all ───────────────────────────────────────────────────────
 * HeroFX give us five concurrent connections to their feed and ask that it is
 * not queried from a page request. A serverless function scales out; every
 * instance would open its own connection, and a modest traffic spike would
 * exhaust the limit and start refusing — including refusing this job. So the
 * dashboard reads our copy, which also means it keeps working while their
 * server is down and never makes an affiliate wait on a cross-Atlantic TLS
 * handshake.
 *
 * Their data moves on a five-minute cycle, so polling faster gains nothing.
 *
 * ── Why it is safe to run at any time ───────────────────────────────────────
 * `herofx_apply_snapshot` replaces the copy inside one transaction, so two
 * runs overlapping leaves the second one's picture and never a half-written
 * one. A failed run changes nothing at all and the last good copy stays up.
 *
 * ── Answering 503 ───────────────────────────────────────────────────────────
 * Without the feed's credentials this route does nothing and says so. That is
 * what lets the whole feature ship before the certificates are in Vercel: the
 * tab appears, says it is not connected yet, and nothing else changes.
 */
export default defineEventHandler(async (event) => {
	requireCronSecret(event, "The HeroFX sync");

	if (!herofxConfigured()) {
		throw createError({ statusCode: 503, statusMessage: "The HeroFX feed is not configured" });
	}

	// Recorded before the work, so a run that dies mid-flight still leaves a
	// trace. The dashboard shows "last updated" from `last_success_at`, and the
	// gap between the two is what says the sync has been failing.
	await db().from("herofx_sync_state")
		.update({ last_attempt_at: new Date().toISOString() })
		.eq("id", true);

	try {
		const snapshot = await readFeedSnapshot();

		const { data, error } = await db().rpc("herofx_apply_snapshot", {
			p_clients: snapshot.clients as unknown as Json,
			p_payments: snapshot.payments as unknown as Json,
			p_commissions: snapshot.commissions as unknown as Json,
			p_metrics: snapshot.metrics as unknown as Json,
			p_status_changes: snapshot.statusChanges as unknown as Json,
			p_freshness: snapshot.freshness as unknown as Json,
		});

		if (error) throw new Error(`apply failed: ${error.message}`);

		// Only after the copy is in place: linking reads the fingerprints the
		// snapshot just wrote, so running it first would match against the
		// previous run's picture.
		const linked = await linkAffiliatesByEmail(event);

		const counts = (data ?? {}) as Record<string, number>;

		return {
			clients: counts.clients ?? 0,
			payments: counts.payments ?? 0,
			prunedStatusChanges: counts.pruned_status_changes ?? 0,
			...linked,
		};
	}
	catch (cause) {
		const message = cause instanceof Error ? cause.message : "unknown";

		// Recorded where the dashboard can see it, so an affiliate reading
		// four-hour-old figures is told they are four hours old rather than
		// being left to assume nothing has happened in the network since.
		await db().from("herofx_sync_state")
			.update({ last_error: message.slice(0, 300) })
			.eq("id", true);

		console.error("[herofx] sync failed:", message);

		// Non-2xx so the run is recorded as failed in the project's cron log
		// rather than reporting a clean pass that copied nothing.
		throw createError({
			statusCode: 500,
			statusMessage: "The HeroFX sync failed",
			data: { error: message.slice(0, 300) },
		});
	}
});
