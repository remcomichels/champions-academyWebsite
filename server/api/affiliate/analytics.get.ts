import { int, object, oneOf, optional } from "../../utils/validate";

/**
 * Visitor analytics for the signed-in affiliate.
 *
 * The affiliate's slug comes from requireAffiliate(), never from the request —
 * `days` is the only thing a caller controls, and it is bounded. There is no
 * way to ask this route about somebody else's traffic.
 *
 * Cached for five minutes: these numbers move slowly, PostHog's query API is
 * rate limited, and a dashboard left open should not hammer it.
 */
export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);

	const query = await getValidatedQuery(event, object({
		days: optional(int({ min: 1, max: 90 })),
		range: optional(oneOf("all")),
	}));

	// "All time" is bounded by when this affiliate was created — there is no
	// traffic of theirs before that, and it keeps the window from growing
	// without limit as the account ages. PostHog itself only retains events for
	// a year on the free plan and moves older data to cold storage, so a truly
	// unbounded query would be slow and return nothing extra.
	const daysSinceJoined = Math.ceil(
		(Date.now() - new Date(affiliate.created_at).getTime()) / (24 * 60 * 60 * 1000),
	);

	const days = query.range === "all"
		? Math.min(Math.max(daysSinceJoined, 1), 3650)
		: (query.days ?? 30);

	if (!posthogConfig()) {
		// Not an error — analytics simply isn't wired up in this environment.
		// The UI says so plainly instead of showing zeroes, which would read as
		// "nobody visited".
		return { configured: false, days, sessions: 0, previousSessions: 0 };
	}

	try {
		const stats = await cachedAffiliateAnalytics(affiliate.slug, days);
		return { configured: true, ...stats };
	}
	catch {
		throw createError({
			statusCode: 503,
			statusMessage: "Analytics is temporarily unavailable",
		});
	}
});

/**
 * Keyed on slug and window only. A cache key sharing anything between
 * affiliates would serve one affiliate's traffic to another.
 */
const cachedAffiliateAnalytics = defineCachedFunction(
	async (slug: string, days: number) => {
		const stats = await affiliateAnalytics(slug, days);
		if (!stats) throw new Error("posthog not configured");
		return stats;
	},
	{
		name: "affiliateAnalytics",
		maxAge: 300,
		swr: true,
		getKey: (slug: string, days: number) => `${slug}:${days}`,
	},
);
