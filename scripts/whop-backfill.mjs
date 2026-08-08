/**
 * Reconciles recent Whop payments into conversions.
 *
 *   node scripts/whop-backfill.mjs <admin-email> <password> [--days 30] [--base https://localhost:3000]
 *
 * A thin client for POST /api/admin/whop/backfill. The attribution rules live
 * in server/utils/conversions.ts and run there — this script deliberately
 * contains none of them.
 *
 * An earlier version reimplemented the rules locally and they drifted within a
 * day: the copy credited the sale but skipped the notification, so a
 * backfilled sale produced no toast and no inbox entry. One implementation,
 * reached over HTTP, cannot drift.
 */
import process from "node:process";
import "dotenv/config";

const args = process.argv.slice(2);
const [email, password] = args;

const flag = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? fallback : args[i + 1];
};

const days = Number(flag("days", 30));
const base = (flag("base", process.env.NUXT_PUBLIC_SITE_URL) || "https://localhost:3000").replace(/\/$/, "");

if (!email || !password) {
	console.error("Usage: node scripts/whop-backfill.mjs <admin-email> <password> [--days 30] [--base URL]");
	process.exit(1);
}

// The dev server uses a self-signed certificate.
if (base.includes("localhost")) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const login = await fetch(`${base}/api/auth/login`, {
	method: "POST",
	headers: { "Content-Type": "application/json", "Origin": base },
	body: JSON.stringify({ email, password }),
});

if (!login.ok) {
	console.error(`Login failed: ${login.status} ${await login.text()}`);
	process.exit(1);
}

const cookie = (login.headers.getSetCookie?.() ?? [])
	.map(c => c.split(";")[0])
	.join("; ");

if (!cookie) {
	console.error("No session cookie returned.");
	process.exit(1);
}

const response = await fetch(`${base}/api/admin/whop/backfill`, {
	method: "POST",
	headers: { "Content-Type": "application/json", "Origin": base, "Cookie": cookie },
	body: JSON.stringify({ days }),
});

const body = await response.json().catch(() => ({}));

if (!response.ok) {
	console.error(`Backfill failed: ${response.status}`, body?.statusMessage ?? "");
	process.exit(1);
}

for (const row of body.results ?? []) {
	console.log(row.credited ? `  ok    ${row.paymentId}` : `  skip  ${row.paymentId} — ${row.reason}`);
}

console.log(`\n${body.credited} credited of ${body.scanned} scanned.`);

await fetch(`${base}/api/auth/logout`, {
	method: "POST",
	headers: { Origin: base, Cookie: cookie },
});
