import { int, object, oneOf, optional } from "../../utils/validate";

interface SalesAggregate {
	sales: number;
	visits: number;
	vip_clicks: number;
	daily: { day: string; sales: number }[];
}

/**
 * The affiliate's own sales.
 *
 * Scoped by requireAffiliate() like every other route here — no identifier is
 * read from the request. `days` is the only thing the caller controls and it is
 * bounded.
 *
 * No money values. Whop owns commission, the 30-day hold and the payout; this
 * dashboard reports attribution only, and anything financial links out to Whop
 * rather than being restated here where it could disagree.
 */
export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);

	const query = await getValidatedQuery(event, object({
		days: optional(int({ min: 1, max: 365 })),
		range: optional(oneOf("all")),
	}));

	// "All time" is bounded by the account's own age — there were no sales of
	// theirs before it existed. Same rule as the traffic route.
	const daysSinceJoined = Math.ceil(
		(Date.now() - new Date(affiliate.created_at).getTime()) / (24 * 60 * 60 * 1000),
	);

	const days = query.range === "all"
		? Math.min(Math.max(daysSinceJoined, 1), 3650)
		: (query.days ?? 30);

	const timezone = canonicalTimezone(affiliate.timezone) ?? "UTC";
	const windowMs = days * 24 * 60 * 60 * 1000;

	const since = new Date(Date.now() - windowMs);
	const until = new Date();
	// The equally long window immediately before, which is what the trend under
	// each figure compares against.
	const priorSince = new Date(Date.now() - windowMs * 2);

	const monthStart = new Date();
	monthStart.setUTCDate(1);
	monthStart.setUTCHours(0, 0, 0, 0);

	const [recent, total, thisMonth, current, prior] = await Promise.all([
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

		db().rpc("affiliate_sales", {
			p_affiliate_id: affiliate.id,
			p_since: since.toISOString(),
			p_until: until.toISOString(),
			p_timezone: timezone,
		}),

		db().rpc("affiliate_sales", {
			p_affiliate_id: affiliate.id,
			p_since: priorSince.toISOString(),
			p_until: since.toISOString(),
			p_timezone: timezone,
		}),
	]);

	if (current.error) {
		throw createError({
			statusCode: 503,
			statusMessage: "Sales figures are temporarily unavailable",
		});
	}

	const window = (current.data ?? {}) as Partial<SalesAggregate>;
	// A failed comparison is not worth failing the page over — the tiles simply
	// show no trend. Same call the traffic route makes.
	const before = (prior.error ? {} : (prior.data ?? {})) as Partial<SalesAggregate>;

	const windowSales = window.sales ?? 0;
	const windowVisits = window.visits ?? 0;
	const windowClicks = window.vip_clicks ?? 0;
	const priorSales = before.sales ?? 0;
	const priorVisits = before.visits ?? 0;
	const priorClicks = before.vip_clicks ?? 0;

	return {
		days,
		timezone,

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
			window: windowSales,
		},

		funnel: {
			visits: windowVisits,
			vipClicks: windowClicks,
			sales: windowSales,
			conversionRate: rate(windowSales, windowVisits),
		},

		previous: {
			sales: priorSales,
			visits: priorVisits,
			vipClicks: priorClicks,
			conversionRate: rate(priorSales, priorVisits),
		},

		// Zero-filled here rather than in the component: this is the side that
		// knows where the window starts and ends, and a chart handed a sparse
		// array closes the quiet days up and draws three scattered sales as
		// three consecutive busy ones.
		series: fillDays(window.daily ?? [], since, until, timezone),
	};
});

/**
 * Null rather than zero when there is no traffic: "0%" reads as "nobody
 * converts", which is a different and more discouraging claim than "we have
 * nothing to divide yet".
 */
function rate(sales: number, visits: number): number | null {
	return visits > 0 ? Math.round((sales / visits) * 1000) / 10 : null;
}

/**
 * One entry per day in the window, oldest first, zeros included.
 *
 * Days are keyed in the affiliate's own timezone because that is how the RPC
 * bucketed them. Deriving the keys from UTC instead would shift every bar by
 * one for anyone far enough east or west, and the chart would disagree with the
 * dates in the table underneath it.
 */
function fillDays(
	daily: { day: string; sales: number }[],
	since: Date,
	until: Date,
	timezone: string,
): { day: string; sales: number }[] {
	const counts = new Map(daily.map(row => [row.day, row.sales]));

	// en-CA gives YYYY-MM-DD, which is what the RPC's ::date casts to.
	const key = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	const out: { day: string; sales: number }[] = [];
	const cursor = new Date(since);

	// Capped, because "all time" on an old account is measured in years and
	// nothing useful is drawn from four thousand bars a few pixels apart. The
	// component thins the labels; this stops the array itself running away.
	const MAX_POINTS = 400;
	const stepMs = Math.max(1, Math.ceil(
		(until.getTime() - since.getTime()) / (MAX_POINTS * 24 * 60 * 60 * 1000),
	)) * 24 * 60 * 60 * 1000;

	while (cursor.getTime() <= until.getTime()) {
		const from = new Date(cursor);
		const to = new Date(Math.min(cursor.getTime() + stepMs, until.getTime() + 1));

		// One bucket is one day at the usual ranges, and a run of days once the
		// window is long enough to need thinning — summed rather than sampled,
		// so the total under the chart still matches the tile above it.
		let sales = 0;
		for (const day = new Date(from); day.getTime() < to.getTime(); day.setUTCDate(day.getUTCDate() + 1)) {
			sales += counts.get(key.format(day)) ?? 0;
		}

		out.push({ day: key.format(from), sales });
		cursor.setTime(cursor.getTime() + stepMs);
	}

	return out;
}
