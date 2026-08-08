/**
 * The affiliate's own sales.
 *
 * Scoped by requireAffiliate() like every other route here — no identifier is
 * read from the request.
 *
 * No money values. Whop owns commission, the 30-day hold and the payout; this
 * dashboard reports attribution only, and anything financial links out to Whop
 * rather than being restated here where it could disagree.
 */
export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);

	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	const monthStart = new Date();
	monthStart.setUTCDate(1);
	monthStart.setUTCHours(0, 0, 0, 0);

	const [recent, total, thisMonth, visits30d] = await Promise.all([
		db().from("conversions")
			.select("whop_payment_id, buyer_username, status, occurred_at")
			.eq("affiliate_id", affiliate.id)
			.order("occurred_at", { ascending: false, nullsFirst: false })
			.limit(50),

		db().from("conversions").select("*", { count: "exact", head: true })
			.eq("affiliate_id", affiliate.id),

		db().from("conversions").select("*", { count: "exact", head: true })
			.eq("affiliate_id", affiliate.id)
			.gte("occurred_at", monthStart.toISOString()),

		db().from("referral_visits").select("*", { count: "exact", head: true })
			.eq("affiliate_id", affiliate.id)
			.gte("day", thirtyDaysAgo.toISOString().slice(0, 10)),
	]);

	const salesLast30 = (recent.data ?? []).filter(
		row => row.occurred_at && new Date(row.occurred_at as string) >= thirtyDaysAgo,
	).length;

	const visitCount = visits30d.count ?? 0;

	return {
		// Username, plan-agnostic, date. Deliberately no email or real name —
		// there is no column for them, so none can leak here.
		sales: (recent.data ?? []).map(row => ({
			id: row.whop_payment_id as string,
			buyerUsername: row.buyer_username as string | null,
			status: row.status as string | null,
			occurredAt: row.occurred_at as string | null,
		})),

		counts: {
			total: total.count ?? 0,
			thisMonth: thisMonth.count ?? 0,
			last30d: salesLast30,
		},

		funnel: {
			visits30d: visitCount,
			sales30d: salesLast30,
			// Null rather than zero when there is no traffic: "0%" reads as
			// "nobody converts", which is a different and discouraging claim.
			conversionRate: visitCount > 0
				? Math.round((salesLast30 / visitCount) * 1000) / 10
				: null,
		},

		// Only VIP is sold. Lite is a Telegram invite and Calendly is a booking
		// page, so neither can ever produce a sale — worth saying rather than
		// letting an affiliate wonder why those links show none.
		nonSellingLinks: {
			lite: Boolean(affiliate.lite_telegram_url),
			calendly: Boolean(affiliate.calendly_url),
		},
	};
});
