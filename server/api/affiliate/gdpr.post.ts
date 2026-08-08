import { object, oneOf } from "../../utils/validate";

/** Deletion sits in a grace period before anything is destroyed. */
const DELETE_GRACE_DAYS = 14;

/**
 * Data export and account deletion requests.
 *
 * Deletion is queued rather than immediate, for two reasons: an account
 * deleted in a bad five minutes should be recoverable, and a request made
 * under pressure by someone who has taken over the account should not be
 * instant either. `cancel` withdraws a pending request.
 *
 * The queue is deliberately not drained automatically — deleting an
 * affiliate cascades to their conversions, which is also the record of sales
 * Whop already paid commission on. That is a decision with an accounting
 * consequence, so it stays a human one.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);
	const session = await requireUser(event);

	const body = await readValidatedBody(event, object({
		action: oneOf("export", "delete", "cancel"),
	}));

	if (body.action === "cancel") {
		const { data } = await db()
			.from("gdpr_requests")
			.update({ status: "cancelled" })
			.eq("affiliate_id", affiliate.id)
			.in("status", ["pending", "ready"])
			.select("id");

		await audit(event, {
			actorKind: "affiliate",
			action: "gdpr.cancelled",
			actorUserId: session.userId,
			subjectAffiliateId: affiliate.id,
			meta: { count: data?.length ?? 0 },
		});

		return { cancelled: data?.length ?? 0 };
	}

	// An export is answered immediately — it is the affiliate's own data and
	// there is nothing to weigh up.
	if (body.action === "export") {
		const [conversions, visits, activity] = await Promise.all([
			db().from("conversions")
				.select("whop_payment_id, buyer_username, status, occurred_at")
				.eq("affiliate_id", affiliate.id),
			db().from("referral_visits")
				.select("day, path, referrer_host, country, occurred_at")
				.eq("affiliate_id", affiliate.id),
			db().from("audit_log")
				.select("at, action, ip")
				.eq("subject_affiliate_id", affiliate.id),
		]);

		await audit(event, {
			actorKind: "affiliate",
			action: "gdpr.exported",
			actorUserId: session.userId,
			subjectAffiliateId: affiliate.id,
		});

		setResponseHeader(event, "content-type", "application/json; charset=utf-8");
		setResponseHeader(event, "cache-control", "private, no-store");
		setResponseHeader(
			event,
			"content-disposition",
			`attachment; filename="${affiliate.slug}-data-export.json"`,
		);

		return {
			exportedAt: new Date().toISOString(),
			profile: {
				slug: affiliate.slug,
				displayName: affiliate.display_name,
				timezone: affiliate.timezone,
				locale: affiliate.locale,
				memberSince: affiliate.created_at,
				links: {
					vip: affiliate.vip_checkout_url,
					telegram: affiliate.lite_telegram_url,
					calendly: affiliate.calendly_url,
				},
			},
			sales: conversions.data ?? [],
			// Visitor rows carry a daily-rotating hash and never an IP or user
			// agent, so there is nothing here that identifies a visitor.
			linkVisits: visits.data ?? [],
			accountActivity: activity.data ?? [],
		};
	}

	const executeAfter = new Date(Date.now() + DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);

	const { error } = await db().from("gdpr_requests").insert({
		affiliate_id: affiliate.id,
		kind: "delete",
		status: "pending",
		execute_after: executeAfter.toISOString(),
	});

	if (error) throw createError({ statusCode: 500, statusMessage: "Could not record the request" });

	await audit(event, {
		actorKind: "affiliate",
		action: "gdpr.delete_requested",
		actorUserId: session.userId,
		subjectAffiliateId: affiliate.id,
		meta: { executeAfter: executeAfter.toISOString() },
	});

	return {
		requested: true,
		executeAfter: executeAfter.toISOString(),
		graceDays: DELETE_GRACE_DAYS,
	};
});
