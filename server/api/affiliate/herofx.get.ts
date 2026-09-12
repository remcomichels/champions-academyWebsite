import { int, object, oneOf, optional } from "../../utils/validate";

/**
 * One affiliate's IB network, from our copy of the HeroFX feed.
 *
 * ── The visibility rule ─────────────────────────────────────────────────────
 * Every client in the feed carries `path_codes`: the chain of partner codes
 * from our root down to whoever referred them. An affiliate's network is
 * `their code = ANY(path_codes)` — themselves and everyone beneath them. A
 * code never appears in the chain of anybody *above* it, so there is no query
 * here that can walk upwards: a sub-IB cannot reach their own upline's clients
 * however they call this route.
 *
 * The code comes from `requireAffiliate()`, never from the request, which is
 * the same rule every other affiliate route follows — see the note at the top
 * of server/utils/auth.ts. `days` is the only thing the caller controls and it
 * is bounded.
 *
 * ── Not linked ──────────────────────────────────────────────────────────────
 * An affiliate with no code gets `linked: false` and nothing else. That is the
 * normal state for a new account: the sync links them automatically once they
 * sign in with the address their HeroFX account uses, and an admin can enter
 * the code by hand when the two addresses differ.
 */
export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);

	const query = await getValidatedQuery(event, object({
		days: optional(int({ min: 1, max: 3650 })),
		range: optional(oneOf("all")),
	}));

	// How current the copy is, and whether the feed itself is behind. Fetched
	// even when the affiliate is unlinked: "not connected" and "connected but
	// the data is stale" are different answers and the page says both.
	const [state, stale] = await Promise.all([
		db().from("herofx_sync_state")
			.select("last_success_at, last_attempt_at, last_error")
			.eq("id", true)
			.maybeSingle(),

		// The feed's own account of itself. `stale` is three cadences behind and
		// is the one worth showing; `lagging` is one and is normal.
		db().from("herofx_freshness")
			.select("job, status, last_success_at")
			.in("status", ["stale", "never"]),
	]);

	const sync = {
		updatedAt: (state.data?.last_success_at as string | null) ?? null,
		// A run that was attempted after the last success is a run that failed.
		failing: Boolean(
			state.data?.last_error
			&& state.data?.last_attempt_at
			&& (!state.data?.last_success_at
				|| new Date(state.data.last_attempt_at) > new Date(state.data.last_success_at)),
		),
		staleJobs: (stale.data ?? []).map(row => ({
			job: row.job as string,
			status: row.status as string | null,
		})),
	};

	// Read here rather than carried on the affiliate row — see `herofxCodeFor`.
	// Scoped to the session's own affiliate id, never to anything the request
	// carried, exactly as every other figure on the dashboard is.
	const code = await herofxCodeFor(affiliate.id);

	if (!code) return { linked: false as const, sync };

	// Null means all time. The windows are half-open — `>= since`, `< until` —
	// so two adjacent ranges never both contain the same payment.
	const days = query.range === "all" ? null : (query.days ?? 30);
	const until = new Date();
	const since = days === null ? null : new Date(until.getTime() - days * 86_400_000);
	const priorSince = days === null ? null : new Date(until.getTime() - days * 2 * 86_400_000);

	const [figures, previous, subIbs, clients] = await Promise.all([
		db().rpc("herofx_network_figures", {
			p_code: code,
			p_since: since?.toISOString() ?? undefined,
			p_until: until.toISOString(),
		}),

		// Skipped entirely for all-time: there is no window before "everything"
		// to compare against, so the tiles show no trend rather than an invented
		// one. Same reasoning as the all-time tile on Analytics.
		days === null
			? Promise.resolve({ data: null, error: null })
			: db().rpc("herofx_network_figures", {
				p_code: code,
				p_since: priorSince!.toISOString(),
				p_until: since!.toISOString(),
			}),

		db().rpc("herofx_sub_ibs", {
			p_code: code,
			p_since: since?.toISOString() ?? undefined,
			p_until: until.toISOString(),
		}),

		// The whole downline, newest first. Capped well under Supabase's own
		// `db_max_rows`, which truncates silently rather than erroring — a
		// network big enough to hit this needs paging, and the page says so
		// rather than quietly showing a prefix.
		db().from("herofx_clients")
			.select(`
				user_id, name, country_iso2, status, referrer_code, own_codes,
				registration_date, ftd_date, deposits_usd, withdrawals_usd,
				live_balance_usd, last_seen
			`)
			.contains("path_codes", [code])
			.order("registration_date", { ascending: false, nullsFirst: false })
			.limit(CLIENT_LIMIT + 1),
	]);

	if (figures.error) {
		throw createError({
			statusCode: 503,
			statusMessage: "Your network figures are temporarily unavailable",
		});
	}

	const subIbRows = ((subIbs.data ?? []) as Record<string, unknown>[]).map(row => ({
		code: row.code as string,
		ownerName: (row.owner_name as string | null) ?? null,
		directClients: num(row.direct_clients),
		networkClients: num(row.network_clients),
		depositsUsd: num(row.deposits_usd),
		commissionUsd: num(row.commission_usd),
	}));

	// Which sub-IB a client came through, resolved here rather than in the
	// browser: the name lives on a different row of the same query and the UI
	// should not have to join two lists to label a column.
	const ownerByCode = new Map(subIbRows.map(row => [row.code, row.ownerName]));

	const clientRows = (clients.data ?? []).slice(0, CLIENT_LIMIT).map((row) => {
		const referrer = row.referrer_code as string | null;

		return {
			userId: Number(row.user_id),
			// Null for a few minutes after somebody joins — the feed fills the
			// detail in on a later poll — so the UI shows the id instead rather
			// than an empty cell.
			name: (row.name as string | null) ?? null,
			country: (row.country_iso2 as string | null) ?? null,
			status: (row.status as string | null) ?? null,
			// "You" for a direct sign-up; the sub-IB's name for anyone below.
			via: referrer === code ? null : (ownerByCode.get(referrer ?? "") ?? referrer),
			isSubIb: ((row.own_codes as string[] | null) ?? []).length > 0,
			registeredAt: (row.registration_date as string | null) ?? null,
			ftdDate: (row.ftd_date as string | null) ?? null,
			depositsUsd: num(row.deposits_usd),
			withdrawalsUsd: num(row.withdrawals_usd),
			balanceUsd: num(row.live_balance_usd),
			lastSeen: (row.last_seen as string | null) ?? null,
		};
	});

	return {
		linked: true as const,
		code,
		days,
		sync,
		figures: shape(figures.data),
		previous: previous.data ? shape(previous.data) : null,
		subIbs: subIbRows,
		clients: clientRows,
		// True when there are more clients than one page can carry.
		clientsTruncated: (clients.data ?? []).length > CLIENT_LIMIT,
	};
});

/**
 * The most clients one response will carry.
 *
 * A thousand rows is the scale the programme is aiming at, and the table is
 * rendered in one go — sending every client of every affiliate would make the
 * largest network's payload the cost everybody pays on first paint.
 */
const CLIENT_LIMIT = 500;

/**
 * Postgres `numeric` arrives as a JSON number through PostgREST, but a null
 * from an empty aggregate arrives as null — and `null` rendered into a money
 * column reads as a fault rather than as zero.
 */
const num = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0) || 0);

/** The figures RPC's JSON, in the shape the dashboard reads. */
function shape(data: unknown) {
	const row = (data ?? {}) as Record<string, unknown>;

	return {
		registered: num(row.registered),
		deposited: num(row.deposited),
		depositsUsd: num(row.deposits_usd),
		withdrawalsUsd: num(row.withdrawals_usd),
		networkClients: num(row.network_clients),
		subIbs: num(row.sub_ibs),
		balanceUsd: num(row.balance_usd),
		commissionUsd: num(row.commission_usd),
	};
}
