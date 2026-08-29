/**
 * Creates an admin account.
 *
 *   node scripts/create-admin.mjs <email> <password>
 *
 * Admins are the only accounts created out of band — affiliates get in by
 * redeeming a one-time invite code. Run this once for yourself; after that,
 * everything happens through the admin panel.
 *
 * Uses the secret key, so it must never run anywhere but your machine or a
 * trusted deploy step.
 */
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
	console.error("Usage: node scripts/create-admin.mjs <email> <password>");
	process.exit(1);
}

if (password.length < 12) {
	// Matches the rule the redeem flow enforces, so admin accounts are not the
	// weak link.
	console.error("Password must be at least 12 characters.");
	process.exit(1);
}

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
	console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env");
	process.exit(1);
}

const db = createClient(url, secret, {
	auth: { persistSession: false, autoRefreshToken: false },
});

// Re-running with an existing email should promote rather than fail, so this
// doubles as "make this person an admin".
const { data: existing } = await db.auth.admin.listUsers({ perPage: 1000 });
let user = existing?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

if (user) {
	console.log(`User already exists (${user.id}) — promoting to admin.`);
}
else {
	const { data, error } = await db.auth.admin.createUser({
		email,
		password,
		// No inbox round-trip: this account is created by whoever owns the
		// database, so there is nothing to prove.
		email_confirm: true,
	});

	if (error) {
		console.error("Could not create user:", error.message);
		process.exit(1);
	}

	user = data.user;
	console.log(`Created auth user ${user.id}`);
}

const { error: adminError } = await db
	.from("admin_users")
	.upsert({ user_id: user.id }, { onConflict: "user_id" });

if (adminError) {
	console.error("Could not grant admin:", adminError.message);
	process.exit(1);
}

console.log(`✓ ${email} is now an admin.`);
