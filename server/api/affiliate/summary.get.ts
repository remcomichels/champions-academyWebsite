import type { LinkRole } from "#shared/types/affiliate";

/**
 * Everything the Overview and Links sections need, in one request.
 *
 * The affiliate is resolved from the session by requireAffiliate() and every
 * query below is filtered by that id. Nothing in this handler reads an
 * identifier from the request — see the note at the top of server/utils/auth.ts.
 */
export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);

	// The heatmap and breakdowns behind the Overview highlights come from the
	// same RPC the Analytics tab uses, over a fixed 30-day window. Reused rather
	// than reimplemented here: PostgREST cannot group, so doing it in this
	// handler would mean pulling every visit row and counting them in memory —
	// which `db_max_rows` would silently truncate on a busy affiliate.
	const HIGHLIGHT_DAYS = 30;
	const timezone = canonicalTimezone(affiliate.timezone) ?? "UTC";

	const [counts, firstVisit, traffic] = await Promise.all([
		// Every counter on this page, bucketed on the affiliate's own local day.
		//
		// These used to be six PostgREST queries filtering `referral_visits.day`,
		// which the referral middleware writes as a *UTC* date — so the Overview
		// and the Analytics tab disagreed about what day it was for anyone not on
		// UTC. At +14 it put most of "Today" into yesterday. The series was also
		// counted row-by-row in this handler, which `db_max_rows` caps.
		db().rpc("affiliate_day_counts", {
			p_affiliate_id: affiliate.id,
			p_timezone: timezone,
			p_days: HIGHLIGHT_DAYS,
		}),

		db().from("referral_visits").select("occurred_at")
			.eq("affiliate_id", affiliate.id)
			.order("occurred_at", { ascending: true })
			.limit(1).maybeSingle(),

		db().rpc("affiliate_traffic", {
			p_affiliate_id: affiliate.id,
			p_since: new Date(Date.now() - HIGHLIGHT_DAYS * 24 * 60 * 60 * 1000).toISOString(),
			p_until: new Date().toISOString(),
			p_timezone: timezone,
		}),
	]);

	const day = (counts.data ?? {}) as {
		today?: number; yesterday?: number; recent?: number; prior?: number;
		total?: number; by_day?: { day: string; count: number }[];
	};

	const highlights = summarise(traffic.data);

	const onboarding = (affiliate.onboarding ?? {}) as Record<string, unknown>;

	// Derived from real state, not from a flag the affiliate could set. Only
	// "shared" is a recorded action, because copying a link leaves no trace.
	const steps = {
		liteTelegramAdded: Boolean(affiliate.lite_telegram_url),
		linkShared: onboarding.linkShared === true,
		firstVisitReceived: Boolean(firstVisit.data),
	};

	const completed = Object.values(steps).filter(Boolean).length;

	const link = (role: LinkRole, value: string | null) =>
		isAllowedLink(role, value) ? value : null;

	return {
		affiliate: {
			slug: affiliate.slug,
			displayName: affiliate.display_name,
			timezone: affiliate.timezone,
			memberSince: affiliate.created_at,
		},

		referralUrl: referralUrl(event, affiliate.slug),

		links: {
			lite: link("lite", affiliate.lite_telegram_url),
		},

		visits: {
			today: day.today ?? 0,
			yesterday: day.yesterday ?? 0,
			last30d: day.recent ?? 0,
			previous30d: day.prior ?? 0,
			total: day.total ?? 0,
			// Already ordered, and already gap-filled: a quiet day is a zero
			// rather than a missing point the chart would join across.
			byDay: day.by_day ?? [],
		},

		onboarding: { steps, completed, total: Object.keys(steps).length },

		highlights: { days: HIGHLIGHT_DAYS, timezone, ...highlights },
	};
});

interface TrafficRow {
	total?: number;
	sources?: { host: string | null; visits: number }[];
	countries?: { country: string; visits: number }[];
	heatmap?: { dow: number; hour: number; visits: number }[];
}

/**
 * The four "what's working" cards, from one pass over the RPC's output.
 *
 * Returns the whole day and hour distributions alongside the peak of each, so
 * the cards can plot the shape the peak came out of rather than asserting it.
 * Both were already being built here to find the maximum and then discarded —
 * keeping them costs nothing, and in particular costs no extra query.
 *
 * Day and hour are aggregated separately rather than read off the single
 * busiest cell. One cell is 1/168th of the window, so on ordinary volume the
 * peak is often a coincidence — "Saturday" and "around 21:00" as independent
 * totals are both steadier and more useful than "Saturday at 21:00".
 *
 * Every field is null when there is nothing behind it, so the UI shows an
 * empty state instead of a confident-looking zero.
 */
function summarise(data: unknown) {
	const row = (data ?? {}) as TrafficRow;
	const heatmap = row.heatmap ?? [];

	const byDow = new Map<number, number>();
	const byHour = new Map<number, number>();
	let counted = 0;

	for (const cell of heatmap) {
		byDow.set(cell.dow, (byDow.get(cell.dow) ?? 0) + cell.visits);
		byHour.set(cell.hour, (byHour.get(cell.hour) ?? 0) + cell.visits);
		counted += cell.visits;
	}

	const top = <T>(entries: Map<number, number>, build: (key: number, visits: number) => T): T | null => {
		let best: { key: number; visits: number } | null = null;
		for (const [key, visits] of entries) {
			if (visits > 0 && (!best || visits > best.visits)) best = { key, visits };
		}
		return best ? build(best.key, best.visits) : null;
	};

	// Dense, in order, zeros included. The maps above are sparse — an hour with
	// no traffic has no entry — and a chart that skipped those slots would
	// redraw the day at the wrong width and imply visits at hours that had
	// none. Filling them here rather than in the component keeps the shape the
	// client receives the same shape it plots.
	const dowTotals = Array.from({ length: 7 }, (_, i) => byDow.get(i + 1) ?? 0);
	const hourTotals = Array.from({ length: 24 }, (_, i) => byHour.get(i) ?? 0);

	return {
		bestDay: top(byDow, (dow, visits) => ({ dow, visits })),
		bestHour: top(byHour, (hour, visits) => ({ hour, visits })),
		topSource: row.sources?.[0] ?? null,
		topCountry: row.countries?.[0] ?? null,

		dowTotals,
		hourTotals,

		// The denominator behind "38% of visits" on the source and country
		// cards. The RPC's own total is authoritative; the heatmap sum is the
		// fallback, and the two are the same figure counted two ways.
		total: row.total ?? counted,
	};
}
