import { int, object, optional } from "../../../utils/validate";

/**
 * Reconciles recent Whop payments into conversions.
 *
 * Runs the *same* ingestPayment() the webhook does. The rules for crediting a
 * sale exist in exactly one place — an earlier version of this lived in a
 * standalone script with its own copy, and they had already drifted: the copy
 * skipped the notification insert, so a backfilled sale never produced a
 * toast or an inbox entry.
 *
 * Webhooks get lost (a deploy mid-delivery, a tunnel that was down, an
 * endpoint that burned its retry budget). This turns a lost delivery into a
 * temporary gap rather than a sale nobody is ever credited for.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);

	const body = await readValidatedBody(event, object({
		days: optional(int({ min: 1, max: 365 })),
	}));

	const days = body.days ?? 30;
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	// Through whopAdmin rather than a hand-rolled fetch, so this inherits the
	// pinned Api-Version-Date. An unversioned request gets an older API whose
	// parameter names differ, and it fails in ways that look like bad config.
	let payments: unknown[];
	try {
		payments = await listCompanyPayments(since);
	}
	catch (error) {
		const detail = error as { data?: { error?: { message?: string } }; message?: string };
		throw createError({
			statusCode: 502,
			statusMessage: `Could not reach Whop: ${detail?.data?.error?.message ?? detail?.message ?? "unknown error"}`,
		});
	}

	const results: { paymentId: string; credited: boolean; reason?: string }[] = [];

	for (const payment of payments as WhopPaymentLike[]) {
		const outcome = await ingestPayment(payment);
		results.push(
			outcome.ok
				? { paymentId: outcome.paymentId, credited: true }
				: { paymentId: payment.id ?? "?", credited: false, reason: outcome.reason },
		);
	}

	const credited = results.filter(r => r.credited).length;

	await audit(event, {
		actorKind: "admin",
		action: "whop.backfill",
		actorUserId: admin.userId,
		meta: { days, scanned: results.length, credited },
	});

	return { scanned: results.length, credited, results };
});
