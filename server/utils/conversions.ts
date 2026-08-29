/**
 * Turning a Whop payment into an attributed conversion.
 *
 * Shared by the webhook and the backfill script so there is exactly one set of
 * rules. Verified against a real sandbox payment (pay_KgWMEkbnvqKYWv).
 *
 * Attribution requires TWO independent signals to agree:
 *
 *   1. `metadata.affiliate_user_id` — the affiliate uuid we stamped on the
 *      checkout configuration, which Whop copies onto the payment.
 *   2. `checkout_configuration_id` — echoed on the payment, cross-checked
 *      against the configuration stored on that same affiliate.
 *
 * Either alone would be enough to credit a sale, which is exactly why both are
 * required: metadata is a free-text field, and a stale or hand-edited value
 * would otherwise silently move someone else's commission.
 */

/** The fields we read off a Whop payment. Everything else is ignored. */
export interface WhopPaymentLike {
	id?: string;
	status?: string | null;
	substatus?: string | null;
	metadata?: unknown;
	checkout_configuration_id?: string | null;
	user?: { username?: string | null } | null;
	paid_at?: string | null;
	created_at?: string | null;
}

export type IngestOutcome =
	| { ok: true; affiliateId: string; paymentId: string; alreadySeen: boolean }
	| { ok: false; reason: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Records a paid Whop payment against an affiliate.
 *
 * Never throws — the webhook must always be able to acknowledge, or Whop
 * retries the same payload forever. Returns why it declined instead.
 */
export async function ingestPayment(payment: WhopPaymentLike): Promise<IngestOutcome> {
	const paymentId = payment.id;
	if (!paymentId) return { ok: false, reason: "payment has no id" };

	// `paid_at` is NOT a success signal — a failed sandbox payment carried a
	// paid_at while sitting at status "open". Only status counts.
	if (payment.status !== "paid") {
		return { ok: false, reason: `status is "${payment.status}", not "paid"` };
	}

	const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
	const affiliateId = metadata.affiliate_user_id;

	if (typeof affiliateId !== "string" || !UUID_RE.test(affiliateId)) {
		// Ordinary for any sale not made through an affiliate's link.
		return { ok: false, reason: "no affiliate_user_id in metadata" };
	}

	const { data: affiliate, error } = await db()
		.from("affiliates")
		.select("id, status, whop_checkout_configuration_id")
		.eq("id", affiliateId)
		.maybeSingle();

	if (error) return { ok: false, reason: "affiliate lookup failed" };
	if (!affiliate) return { ok: false, reason: "affiliate_user_id does not match an affiliate" };

	if (affiliate.status !== "active") {
		return { ok: false, reason: `affiliate is ${affiliate.status}` };
	}

	// The second signal. A payment that does not come through this affiliate's
	// own checkout configuration is not credited to them, whatever the metadata
	// claims.
	const configOnPayment = payment.checkout_configuration_id;
	const configOnAffiliate = affiliate.whop_checkout_configuration_id;

	if (!configOnPayment) {
		return { ok: false, reason: "payment carries no checkout_configuration_id" };
	}

	if (configOnPayment !== configOnAffiliate) {
		return {
			ok: false,
			reason: `checkout configuration ${configOnPayment} is not the one on this affiliate`,
		};
	}

	// Already recorded? Whop retries, and the backfill overlaps the webhook by
	// design, so this is the normal case rather than an error.
	const { data: existing } = await db()
		.from("conversions")
		.select("whop_payment_id")
		.eq("whop_payment_id", paymentId)
		.maybeSingle();

	// GDPR boundary. Username only — there is no column for email or real name
	// downstream, so a later change cannot leak them by accident.
	const { error: upsertError } = await db()
		.from("conversions")
		.upsert({
			whop_payment_id: paymentId,
			affiliate_id: affiliate.id,
			buyer_username: payment.user?.username ?? null,
			status: payment.status,
			occurred_at: payment.paid_at ?? payment.created_at ?? new Date().toISOString(),
			raw: {
				substatus: payment.substatus ?? null,
				checkout_configuration_id: configOnPayment,
			},
		}, { onConflict: "whop_payment_id" });

	if (upsertError) return { ok: false, reason: `could not store conversion: ${upsertError.message}` };

	// One notification per sale, not per delivery attempt.
	if (!existing) {
		await db().from("notifications").insert({
			affiliate_id: affiliate.id,
			kind: "sale",
			payload: {
				paymentId,
				buyerUsername: payment.user?.username ?? null,
			},
		});
	}

	return { ok: true, affiliateId: affiliate.id, paymentId, alreadySeen: Boolean(existing) };
}
