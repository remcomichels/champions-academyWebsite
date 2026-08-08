/**
 * Reconciles recent Whop payments into conversions.
 *
 *   node scripts/whop-backfill.mjs [--days 30] [--dry]
 *
 * Webhooks get lost — a deploy mid-delivery, a tunnel that was down, an
 * endpoint that 500'd past Whop's retry budget. This pulls recent payments and
 * applies exactly the same attribution rules, so a missed delivery is a
 * temporary gap rather than a sale that never gets credited.
 *
 * Safe to run repeatedly: the upsert is keyed on the payment id.
 *
 * Deliberately a script and not a cron. On the traffic this runs at, a
 * scheduled poll would burn API quota to keep data fresh for nobody.
 */
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const days = Number(args[args.indexOf("--days") + 1]) || 30;

const {
	SUPABASE_URL, SUPABASE_SECRET_KEY,
	WHOP_API_KEY, WHOP_BIZ_KEY,
	WHOP_BASE_URL = "https://api.whop.com/api/v1",
} = process.env;

for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SECRET_KEY, WHOP_API_KEY, WHOP_BIZ_KEY })) {
	if (!value) {
		console.error(`${name} is not set in .env`);
		process.exit(1);
	}
}

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

console.log(`Host:  ${WHOP_BASE_URL}`);
console.log(`Since: ${since}${dry ? "   (dry run)" : ""}\n`);

const url = `${WHOP_BASE_URL}/payments?company_id=${WHOP_BIZ_KEY}&first=100&created_after=${encodeURIComponent(since)}`;
const response = await fetch(url, {
	headers: { Authorization: `Bearer ${WHOP_API_KEY}`, Accept: "application/json" },
});

if (!response.ok) {
	console.error(`Whop returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
	process.exit(1);
}

const payments = (await response.json()).data ?? [];
console.log(`${payments.length} payment(s) returned\n`);

let credited = 0;
let skipped = 0;

for (const payment of payments) {
	const label = `${payment.id} ${String(payment.status).padEnd(6)} ${payment.user?.username ?? "?"}`;

	// Mirrors server/utils/conversions.ts. Kept in step deliberately — if the
	// rules there change, they must change here too.
	if (payment.status !== "paid") { console.log(`  skip  ${label} — not paid`); skipped++; continue; }

	const affiliateId = payment.metadata?.affiliate_user_id;
	if (typeof affiliateId !== "string" || !UUID_RE.test(affiliateId)) {
		console.log(`  skip  ${label} — no affiliate_user_id`); skipped++; continue;
	}

	const { data: affiliate } = await db
		.from("affiliates")
		.select("id, slug, status, whop_checkout_configuration_id")
		.eq("id", affiliateId)
		.maybeSingle();

	if (!affiliate) { console.log(`  skip  ${label} — unknown affiliate`); skipped++; continue; }
	if (affiliate.status !== "active") { console.log(`  skip  ${label} — ${affiliate.status}`); skipped++; continue; }

	if (!payment.checkout_configuration_id
		|| payment.checkout_configuration_id !== affiliate.whop_checkout_configuration_id) {
		console.log(`  skip  ${label} — checkout configuration mismatch`); skipped++; continue;
	}

	if (dry) { console.log(`  would credit ${label} -> ${affiliate.slug}`); credited++; continue; }

	const { error } = await db.from("conversions").upsert({
		whop_payment_id: payment.id,
		affiliate_id: affiliate.id,
		buyer_username: payment.user?.username ?? null,
		status: payment.status,
		occurred_at: payment.paid_at ?? payment.created_at,
		raw: {
			substatus: payment.substatus ?? null,
			checkout_configuration_id: payment.checkout_configuration_id,
			source: "backfill",
		},
	}, { onConflict: "whop_payment_id" });

	if (error) { console.log(`  FAIL  ${label} — ${error.message}`); skipped++; continue; }

	console.log(`  ok    ${label} -> ${affiliate.slug}`);
	credited++;
}

console.log(`\n${credited} credited, ${skipped} skipped.`);
