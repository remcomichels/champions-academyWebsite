import { int, object, oneOf, optional } from "../../utils/validate";

interface TrafficBreakdowns {
	total: number;
	sources: { host: string | null; visits: number }[];
	countries: { country: string; visits: number }[];
	paths: { path: string; visits: number }[];
	heatmap: { dow: number; hour: number; visits: number }[];
}

/**
 * Where an affiliate's traffic came from, landed, and when it arrived.
 *
 * Every figure comes from `referral_visits`, which the referral middleware has
 * been writing since day one — referrer host, country, landing path and a
 * timestamp, recorded server-side on the `?r=` hit. Nothing new is collected
 * for this route, and nothing here is measured in the browser, so ad blockers
 * cannot suppress any of it.
 *
 * The affiliate comes from requireAffiliate(); `days` is the only thing the
 * caller controls and it is bounded. There is no way to ask this route about
 * anybody else's traffic — see the note at the top of server/utils/auth.ts.
 */
export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);

	const query = await getValidatedQuery(event, object({
		days: optional(int({ min: 1, max: 365 })),
		range: optional(oneOf("all")),
	}));

	// "All time" is bounded by the account's own age — there is no traffic of
	// theirs before it existed.
	const daysSinceJoined = Math.ceil(
		(Date.now() - new Date(affiliate.created_at).getTime()) / (24 * 60 * 60 * 1000),
	);

	const days = query.range === "all"
		? Math.min(Math.max(daysSinceJoined, 1), 3650)
		: (query.days ?? 30);

	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	const { data, error } = await db().rpc("affiliate_traffic", {
		p_affiliate_id: affiliate.id,
		p_since: since,
		p_timezone: safeTimezone(affiliate.timezone),
	});

	if (error) {
		throw createError({
			statusCode: 503,
			statusMessage: "Traffic figures are temporarily unavailable",
		});
	}

	const breakdowns = (data ?? {}) as Partial<TrafficBreakdowns>;

	return {
		days,
		timezone: safeTimezone(affiliate.timezone),
		total: breakdowns.total ?? 0,
		sources: breakdowns.sources ?? [],
		countries: breakdowns.countries ?? [],
		paths: breakdowns.paths ?? [],
		heatmap: breakdowns.heatmap ?? [],
	};
});

/**
 * The timezone is affiliate-editable free text on the Settings form, and
 * Postgres raises on an unknown name in `at time zone` — which would turn a
 * typo in someone's profile into a 503 on their own dashboard. Falling back to
 * UTC keeps the page working; the hours are just less useful until they fix it.
 */
function safeTimezone(value: string | null | undefined): string {
	if (!value) return "UTC";

	try {
		new Intl.DateTimeFormat("en-GB", { timeZone: value });
		return value;
	}
	catch {
		return "UTC";
	}
}
