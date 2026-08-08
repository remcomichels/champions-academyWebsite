/**
 * Creates a Whop checkout configuration for one affiliate and stores it.
 *
 *   node scripts/whop-checkout-config.mjs <affiliate-slug>
 *
 * This is the attribution mechanism. The configuration carries
 * `metadata.affiliate_user_id`, which Whop copies onto the resulting payment
 * and membership and into the payment.succeeded webhook — that is how a sale
 * gets credited, rather than through Whop's affiliate counters, which we saw
 * fail to update under conditions that should have worked.
 *
 * A first cut of what the admin panel's "Whop onboard" action will do in S8.
 * Idempotent: re-running reuses the stored configuration unless --force.
 */
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import Whop from "@whop/sdk";
import "dotenv/config";

const slug = process.argv[2];
const force = process.argv.includes("--force");

if (!slug) {
	console.error("Usage: node scripts/whop-checkout-config.mjs <affiliate-slug> [--force]");
	process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SECRET_KEY, WHOP_API_KEY, WHOP_BIZ_KEY, WHOP_PLAN_ID } = process.env;

for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SECRET_KEY, WHOP_API_KEY, WHOP_BIZ_KEY, WHOP_PLAN_ID })) {
	if (!value) {
		console.error(`${name} is not set in .env`);
		process.exit(1);
	}
}

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
	auth: { persistSession: false },
});

const { data: affiliate, error } = await db
	.from("affiliates")
	.select("id, slug, display_name, whop_checkout_configuration_id, vip_checkout_url")
	.eq("slug", slug)
	.maybeSingle();

if (error || !affiliate) {
	console.error(`No affiliate with slug "${slug}"`);
	process.exit(1);
}

if (affiliate.whop_checkout_configuration_id && !force) {
	console.log(`Already onboarded: ${affiliate.whop_checkout_configuration_id}`);
	console.log(`  ${affiliate.vip_checkout_url}`);
	console.log("Re-run with --force to create a new configuration.");
	process.exit(0);
}

const whop = new Whop({ apiKey: WHOP_API_KEY });

console.log(`Creating checkout configuration for ${affiliate.display_name} (${affiliate.slug})…`);

const config = await whop.checkoutConfigurations.create({
	account_id: WHOP_BIZ_KEY,
	plan_id: WHOP_PLAN_ID,
	// The whole point. Whop copies this onto the payment and the webhook.
	metadata: { affiliate_user_id: affiliate.id },
});

console.log("\nResponse:");
console.log(JSON.stringify(config, null, 2));

const purchaseUrl = config?.purchase_url;

if (!purchaseUrl) {
	console.error("\nNo purchase_url returned — nothing stored.");
	process.exit(1);
}

// The same host allow-list the app enforces. If Whop ever returns a link on
// another domain, fail here rather than write a row the site will refuse to
// render anyway.
const host = new URL(purchaseUrl).hostname.toLowerCase();
if (!["whop.com", "www.whop.com"].includes(host)) {
	console.error(`\npurchase_url is on ${host}, not whop.com — not stored.`);
	console.error("The DB CHECK constraint and the render-time guard would both reject it.");
	process.exit(1);
}

const { error: saveError } = await db
	.from("affiliates")
	.update({
		whop_checkout_configuration_id: config.id,
		vip_checkout_url: purchaseUrl,
	})
	.eq("id", affiliate.id);

if (saveError) {
	console.error("\nCould not store it:", saveError.message);
	process.exit(1);
}

console.log(`\n✓ Stored for ${affiliate.slug}`);
console.log(`  configuration: ${config.id}`);
console.log(`  purchase_url:  ${purchaseUrl}`);
console.log(`  metadata:      affiliate_user_id=${affiliate.id}`);
