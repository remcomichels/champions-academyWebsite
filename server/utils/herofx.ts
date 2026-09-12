import { createHmac } from "node:crypto";
import { Client } from "pg";

/**
 * Reading the HeroFX IB feed.
 *
 * A read-only PostgreSQL database of the IB structure beneath our partner
 * code, reached over mutual TLS: we present a client certificate *and* a
 * password, and neither alone gets in. There is no IP allow-list, which is
 * what makes the certificate the only thing between the data and the open
 * internet — so `rejectUnauthorized` is never turned off here, whatever a
 * certificate error tempts anyone to try.
 *
 * Two limits shape everything below. We have **five concurrent connections in
 * total**, and statements are capped at 30 seconds. So this opens exactly one
 * connection, reads seven small views inside a single transaction, and closes
 * it. Nothing else in the app may talk to this database: the dashboard reads
 * the copy in our own tables, written by /api/internal/herofx-sync.
 */

interface FeedConfig {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	ca: string;
	cert: string;
	key: string;
}

/**
 * A PEM out of the environment, however it was pasted in.
 *
 * Base64 is what our own .env holds, because a multi-line value in a dotenv
 * file is a quoting trap. HeroFX's own documentation tells integrators to
 * paste the file contents whole into Vercel instead, newlines included, and
 * somebody following it should not end up with a sync that fails on a
 * certificate error. Both are accepted, and a value carrying literal `\n`
 * escapes — what happens when a PEM is pasted into a single-line field — is
 * repaired rather than rejected.
 */
function readPem(value: string): string {
	const raw = value.trim();
	if (!raw) return "";

	const pem = raw.includes("-----BEGIN")
		? raw
		: Buffer.from(raw, "base64").toString("utf8");

	return pem.replace(/\\n/g, "\n");
}

/** The feed's settings, or null when it has not been configured. */
function feedConfig(): FeedConfig | null {
	const config = useRuntimeConfig();

	const host = (config.herofxHost as string) || "";
	const database = (config.herofxDatabase as string) || "";
	const user = (config.herofxUser as string) || "";
	const password = (config.herofxPassword as string) || "";
	const ca = readPem((config.herofxCa as string) || "");
	const cert = readPem((config.herofxCert as string) || "");
	const key = readPem((config.herofxKey as string) || "");

	// All or nothing. A half-configured feed would fail at connect time with a
	// TLS error that says nothing about the missing variable behind it.
	if (!host || !database || !user || !password || !ca || !cert || !key) return null;

	return {
		host,
		port: Number((config.herofxPort as string) || 5432) || 5432,
		database,
		user,
		password,
		ca,
		cert,
		key,
	};
}

/** Whether the feed can be reached at all. Routes answer 503 when it cannot. */
export function herofxConfigured(): boolean {
	return feedConfig() !== null;
}

/**
 * The partner code on one affiliate's account, or null.
 *
 * Read here rather than in `requireAffiliate`'s column list, and tolerant of
 * its own failure, for one reason: this column arrives with a migration, and a
 * select naming a column the database does not have yet fails outright. In the
 * affiliate lookup that would mean every authenticated request 500s and nobody
 * can open the dashboard at all; here the worst case is an affiliate seeing
 * "connect your HeroFX account" on one tab until the migration lands.
 *
 * That is not hypothetical in this project — see the note at the top of
 * .github/workflows/database.yml.
 */
export async function herofxCodeFor(affiliateId: string): Promise<string | null> {
	const { data, error } = await db()
		.from("affiliates")
		.select("herofx_code")
		.eq("id", affiliateId)
		.maybeSingle();

	if (error) {
		console.error("[herofx] could not read the partner code:", error.message);
		return null;
	}

	return (data?.herofx_code as string | null) ?? null;
}

/**
 * A one-way fingerprint of an email address.
 *
 * How an affiliate is linked to their partner code: the feed knows the address
 * of the client who owns each code, and this is compared against the address
 * they sign in to the dashboard with. Storing the fingerprint rather than the
 * address means the copy of the feed holds no contact details for anybody,
 * while the match still works.
 *
 * HMAC-SHA256 with OTP_PEPPER rather than a bare hash: the space of email
 * addresses is small enough to enumerate, so an unpeppered digest is
 * reversible by anyone holding a mailing list. The string prefix is domain
 * separation — the same pepper hashes invite codes, and the two must never
 * produce a colliding digest for the same input.
 */
export function emailFingerprint(email: string): string {
	const pepper = useRuntimeConfig().otpPepper as string;

	if (!pepper) {
		throw createError({ statusCode: 500, statusMessage: "OTP_PEPPER is not configured" });
	}

	return createHmac("sha256", pepper)
		.update(`herofx-email:${email.trim().toLowerCase()}`)
		.digest("hex");
}

/**
 * One row of each view, as it goes into `herofx_apply_snapshot`.
 *
 * Numerics and bigints are `string` on purpose: node-postgres returns both as
 * strings so that a value wider than a float64 is not silently rounded on the
 * way through. They stay strings all the way into the JSON payload, and
 * Postgres parses them back with the column type's own input function.
 */
export interface FeedSnapshot {
	clients: Record<string, unknown>[];
	payments: Record<string, unknown>[];
	commissions: Record<string, unknown>[];
	metrics: Record<string, unknown>[];
	statusChanges: Record<string, unknown>[];
	freshness: Record<string, unknown>[];
}

/**
 * `date` columns are cast to text in the queries below.
 *
 * node-postgres turns a bare `date` into a JS Date at *local* midnight, which
 * serialises to the previous day in ISO for anyone west of UTC — so a run from
 * a laptop in Amsterdam would file every commission and metric under the wrong
 * day. Reading them as text sidesteps the type parser entirely.
 */
const QUERIES = {
	clients: `
		select user_id, name, email, registration_date, status, country_iso2,
		       referrer_code, own_codes, path_codes,
		       live_balance_usd, deposits_usd, withdrawals_usd,
		       ftd_date, last_seen
		from clients
	`,
	deposits: `
		select payment_id, user_id, referrer_code, path_codes, psp, amount_usd, created_at
		from deposits
	`,
	withdrawals: `
		select payment_id, user_id, referrer_code, path_codes, psp, amount_usd, created_at
		from withdrawals
	`,
	commissions: `
		select code, period::text as period, program, status, calculated_usd, available_usd
		from commissions_daily
	`,
	metrics: `
		select code, day::text as day, joined_users, real_accounts, demo_accounts,
		       deposited_users, deposits_usd, withdrawals_usd, traded_volume, kyc_verified
		from metrics_daily
	`,
	statusChanges: `
		select user_id, old_status, new_status, changed_at
		from status_changes
	`,
	freshness: `
		select job, last_success_at, status, cadence_seconds, seconds_since_success
		from data_freshness
	`,
} as const;

/**
 * Reads every view we copy, as one consistent picture.
 *
 * `repeatable read` matters more than it looks: the feed refreshes on a
 * five-minute cycle, and without it a client could arrive between the clients
 * query and the deposits query, leaving a payment in the copy whose payer is
 * not in it. Read-only, so the isolation level costs the feed nothing.
 *
 * Email never leaves this function. It is read so that a code owner can be
 * matched to an affiliate, replaced by its fingerprint here, and dropped —
 * `herofx_clients` has no column to hold an address even if it wanted one.
 */
export async function readFeedSnapshot(): Promise<FeedSnapshot> {
	const config = feedConfig();

	if (!config) {
		throw createError({ statusCode: 503, statusMessage: "The HeroFX feed is not configured" });
	}

	const client = new Client({
		host: config.host,
		port: config.port,
		database: config.database,
		user: config.user,
		password: config.password,
		ssl: {
			ca: config.ca,
			cert: config.cert,
			key: config.key,
			// The equivalent of libpq's sslmode=verify-full, and the line their
			// documentation asks integrators not to touch. False here would mean
			// encrypting to whoever answers on that address.
			rejectUnauthorized: true,
			servername: config.host,
		},
		connectionTimeoutMillis: 10_000,
		// Under their own 30-second cap, so a slow query surfaces here as a
		// timeout we can report rather than as a connection the feed kills.
		statement_timeout: 25_000,
	});

	await client.connect();

	try {
		await client.query("begin isolation level repeatable read read only");

		const [clients, deposits, withdrawals, commissions, metrics, statusChanges, freshness] =
			await Promise.all([
				client.query(QUERIES.clients),
				client.query(QUERIES.deposits),
				client.query(QUERIES.withdrawals),
				client.query(QUERIES.commissions),
				client.query(QUERIES.metrics),
				client.query(QUERIES.statusChanges),
				client.query(QUERIES.freshness),
			]);

		await client.query("commit");

		return {
			clients: clients.rows.map((row) => {
				const { email, ...rest } = row as Record<string, unknown> & { email?: string | null };
				const ownCodes = (rest.own_codes as string[] | null) ?? [];

				return {
					...rest,
					own_codes: ownCodes,
					// Only for clients who are IBs themselves. Nobody else can be
					// linked to a dashboard account, so nobody else needs one — and
					// a fingerprint that is never looked up is a hash of a real
					// person's address kept for no reason.
					email_fingerprint: ownCodes.length && email ? emailFingerprint(email) : null,
				};
			}),

			// One table, one `kind` column: the two views have identical shapes
			// and every figure over them is the same query with one value changed.
			payments: [
				...deposits.rows.map(row => ({ ...row, kind: "deposit" })),
				...withdrawals.rows.map(row => ({ ...row, kind: "withdrawal" })),
			],

			commissions: commissions.rows,
			metrics: metrics.rows,
			statusChanges: statusChanges.rows,
			freshness: freshness.rows,
		};
	}
	finally {
		// Always, including after a failed query: their idle-in-transaction
		// timeout is 60 seconds and we hold one of five connections.
		await client.end().catch(() => {});
	}
}
