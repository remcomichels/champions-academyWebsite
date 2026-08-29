import { int, object, optional } from "../../utils/validate";

interface ProgramAnalytics {
	visits: number;
	clicks: number;
	sales: number;
	country_count: number;
	affiliates_total: number;
	affiliates_active: number;
	affiliates_selling: number;
	by_day: { day: string; visits: number; clicks: number; sales: number }[];
	sources: { host: string | null; visits: number }[];
	countries: { country: string | null; visits: number }[];
	clicks_by_role: { role: string; clicks: number }[];
	leaderboard: {
		id: string; slug: string; displayName: string; status: string;
		visits: number; clicks: number; sales: number;
	}[];
}

/**
 * Programme-wide figures for the admin dashboard.
 *
 * Reading across every affiliate is the entire point here, which is why this
 * lives under /api/admin/ behind requireAdmin rather than anywhere near the
 * affiliate routes — see the boundary note in server/utils/auth.ts.
 *
 * UTC rather than a timezone. The affiliate-facing charts bucket in the
 * affiliate's own zone so a sale at 01:00 in Amsterdam lands on the day it
 * felt like; a programme spanning several zones has no such "own" zone, and
 * picking one affiliate's would quietly shift everyone else's days.
 */
export default defineEventHandler(async (event) => {
	await requireAdmin(event);

	const query = await getValidatedQuery(event, object({
		days: optional(int({ min: 1, max: 365 })),
	}));

	const days = query.days ?? 30;
	const windowMs = days * 24 * 60 * 60 * 1000;

	const since = new Date(Date.now() - windowMs).toISOString();
	const until = new Date().toISOString();
	// The equally long window immediately before, which is what every trend on
	// the page compares against.
	const priorSince = new Date(Date.now() - windowMs * 2).toISOString();

	const [current, prior] = await Promise.all([
		db().rpc("program_analytics", {
			p_since: since, p_until: until, p_timezone: "UTC", p_leaders: 10,
		}),
		db().rpc("program_analytics", {
			p_since: priorSince, p_until: since, p_timezone: "UTC", p_leaders: 1,
		}),
	]);

	if (current.error) {
		throw createError({ statusCode: 500, statusMessage: "Could not load programme analytics" });
	}

	const now = current.data as ProgramAnalytics;
	// The prior window is only ever read for its totals; a failure there costs
	// the trends and nothing else, so it must not take the page down with it.
	const was = (prior.data ?? null) as ProgramAnalytics | null;

	const period = days === 1 ? "vs yesterday" : `vs previous ${days} days`;

	return {
		days,
		totals: {
			visits: now.visits,
			clicks: now.clicks,
			sales: now.sales,
			countries: now.country_count,
			affiliatesTotal: now.affiliates_total,
			affiliatesActive: now.affiliates_active,
			affiliatesSelling: now.affiliates_selling,
		},
		trends: was
			? {
					visits: trend(now.visits, was.visits, period),
					clicks: trend(now.clicks, was.clicks, period),
					sales: trend(now.sales, was.sales, period),
					active: trend(now.affiliates_active, was.affiliates_active, period),
				}
			: { visits: null, clicks: null, sales: null, active: null },

		byDay: now.by_day,

		// Paired with the same host in the previous window, because that is what
		// the donut's per-row trend divides by. Absent from the prior window
		// means zero, not missing — a source that appeared this period genuinely
		// went from nothing.
		sources: now.sources.map((source) => {
			const before = was?.sources.find(row => row.host === source.host);
			return {
				label: source.host ?? "Direct",
				visits: source.visits,
				previousVisits: before?.visits ?? 0,
			};
		}),
		countries: now.countries,
		clicksByRole: now.clicks_by_role,
		leaderboard: now.leaderboard,

		// The three steps the programme actually funnels through. Sent as
		// counts, not percentages, so the client can label them however it
		// wants without re-deriving anything.
		funnel: [
			{ label: "Link visits", value: now.visits },
			{ label: "Plan clicks", value: now.clicks },
			{ label: "Sales", value: now.sales },
		],
	};
});
