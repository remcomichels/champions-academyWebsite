/**
 * PostHog Query API, server-side only.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * The personal API key used here can read EVERY visitor event in the project,
 * not just one affiliate's. It must never reach a browser, and no caller may
 * supply a query.
 *
 * Callers pass an affiliate slug and pick from the fixed set of queries below.
 * The slug is re-validated against the same pattern the database enforces
 * before it is interpolated, so a stored value cannot smuggle HogQL in.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Matches the slug CHECK constraint on public.affiliates. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/;

export interface PosthogConfig {
	apiHost: string;
	projectId: string;
	personalApiKey: string;
}

/**
 * Resolves the API host.
 *
 * Queries go to the app host, not the ingestion host — us.i.posthog.com
 * ingests events and returns 404 for /api/projects/. When only POSTHOG_HOST is
 * set (the ingestion host, which is what PostHog's own snippets show), the
 * `i.` is stripped to get the API host. Holds for both regions:
 * us.i.posthog.com -> us.posthog.com, eu.i.posthog.com -> eu.posthog.com.
 */
export function posthogConfig(): PosthogConfig | null {
	const config = useRuntimeConfig();

	const personalApiKey = config.posthogPersonalApiKey as string;
	const projectId = config.posthogProjectId as string;
	const explicit = config.posthogApiHost as string;
	const ingest = config.public.posthogHost as string;

	if (!personalApiKey || !projectId) return null;

	let apiHost = explicit;

	if (!apiHost && ingest) {
		try {
			const url = new URL(ingest);
			url.hostname = url.hostname.replace(/^([a-z]{2})\.i\./, "$1.");
			apiHost = url.origin;
		}
		catch {
			return null;
		}
	}

	return apiHost ? { apiHost, projectId, personalApiKey } : null;
}

interface HogQLResponse {
	results?: unknown[][];
	columns?: string[];
}

/** Runs one HogQL query. Never accepts a query from outside this module. */
async function runQuery(config: PosthogConfig, query: string): Promise<HogQLResponse> {
	return await $fetch<HogQLResponse>(
		`${config.apiHost}/api/projects/${encodeURIComponent(config.projectId)}/query/`,
		{
			method: "POST",
			headers: {
				"Authorization": `Bearer ${config.personalApiKey}`,
				"Content-Type": "application/json",
			},
			body: { query: { kind: "HogQLQuery", query } },
			timeout: 15000,
		},
	);
}

export interface AffiliateAnalytics {
	sessions: number;
	countries: { country: string; sessions: number }[];
	days: number;
}

/**
 * Sessions and geography for one affiliate.
 *
 * Deliberately measured in ONE unit. A visitor count used to live here too,
 * which meant the dashboard showed two different "visitors" numbers — this one
 * and the server-counted link visits on Overview — that could never agree,
 * because anything counted in the browser is lost to ad blockers while the
 * server-side count is not. Link visits are the affiliate's number; this tab
 * describes behaviour, not headcount.
 *
 * Narrow on purpose: traffic sources, devices, scroll depth, heatmaps, session
 * recordings and funnels are all deferred.
 */
export async function affiliateAnalytics(slug: string, days: number): Promise<AffiliateAnalytics | null> {
	const config = posthogConfig();
	if (!config) return null;

	// Belt and braces. The slug comes from our own database, but this function
	// builds HogQL by interpolation, so it verifies rather than assumes.
	if (!SLUG_RE.test(slug)) {
		throw createError({ statusCode: 500, statusMessage: "Refusing to query with a malformed slug" });
	}

	// Ten years is the ceiling rather than one, because paid PostHog plans
	// retain events for seven. Anything beyond retention simply returns
	// nothing — it is not an error, just an empty window.
	const window = Math.min(Math.max(Math.trunc(days), 1), 3650);

	// Every query is filtered by affiliate_slug. There is no code path that
	// omits this clause.
	const scope = `properties.affiliate_slug = '${slug}' AND timestamp >= now() - INTERVAL ${window} DAY`;

	const [totals, geo] = await Promise.all([
		runQuery(config, `
			SELECT count(DISTINCT properties.$session_id) AS sessions
			FROM events
			WHERE ${scope}
		`),
		runQuery(config, `
			SELECT coalesce(properties.$geoip_country_name, 'Unknown') AS country,
			       count(DISTINCT properties.$session_id) AS sessions
			FROM events
			WHERE ${scope}
			GROUP BY country
			ORDER BY sessions DESC
			LIMIT 10
		`),
	]);

	const row = totals.results?.[0] ?? [];

	return {
		sessions: Number(row[0] ?? 0),
		countries: (geo.results ?? []).map(r => ({
			country: String(r[0] ?? "Unknown"),
			sessions: Number(r[1] ?? 0),
		})),
		days: window,
	};
}
