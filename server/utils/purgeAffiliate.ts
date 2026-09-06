import { randomBytes } from "node:crypto";

/**
 * Erasing an affiliate.
 *
 * ── What "delete" means here ────────────────────────────────────────────────
 * The person is erased; the programme's arithmetic is not. Every row that says
 * who somebody is or what they did goes — their login, their sessions, their
 * notifications and feedback, the visits and clicks their link collected — and
 * the affiliate row itself survives with every personal field blanked.
 *
 * The programme-wide figures are what that distinction is for. Deleting the
 * affiliate row outright cascades into everything hanging off it, and those
 * rows are aggregated programme-wide by `program_analytics` — so a deletion
 * would silently rewrite last quarter's totals for everyone else, and a report
 * which changes when an unrelated person closes their account is not a report.
 *
 * Their own visits and clicks still go, because those name a person's audience.
 * What survives is the affiliate row: an anonymous shell the aggregates can
 * still be counted against.
 *
 * ── Why every table is named ────────────────────────────────────────────────
 * Most of these have `on delete cascade` and would go on their own if the row
 * were deleted. The row is not deleted, so they are removed by hand — and the
 * ones hanging off `auth.users` are listed too rather than trusted to the
 * cascade, because `information_schema` will not report cross-schema foreign
 * keys under this role and an unverified cascade is not something to leave a
 * deletion resting on.
 *
 * Adding a table that references an affiliate means adding it here. There is no
 * way to make that automatic that is not worse than remembering.
 */

/** What the affiliate row is left saying once nobody is behind it. */
const ERASED_NAME = "Deleted affiliate";

export interface PurgeResult {
	affiliateId: string;
	/** False when there was no login attached — an invite never redeemed. */
	authUserDeleted: boolean;
}

/**
 * Erases one affiliate. Safe to run twice: everything here is a delete or an
 * overwrite, so a job that dies half way can simply be run again.
 */
export async function purgeAffiliate(affiliateId: string): Promise<PurgeResult> {
	const { data: affiliate, error } = await db()
		.from("affiliates")
		.select("id, user_id")
		.eq("id", affiliateId)
		.maybeSingle();

	if (error || !affiliate) {
		throw new Error(`purge: affiliate ${affiliateId} could not be read`);
	}

	const userId = affiliate.user_id as string | null;

	// The login first. Until this is gone the account can still be signed into,
	// and everything below is undone by one session that outlived it.
	let authUserDeleted = false;

	if (userId) {
		// Sessions before the user, so a request in flight cannot re-read a row
		// that is about to lose its owner.
		await db().from("sessions").delete().eq("user_id", userId);
		await db().from("password_resets").delete().eq("user_id", userId);
		await db().from("email_changes").delete().eq("user_id", userId);

		const { error: authError } = await db().auth.admin.deleteUser(userId);

		// A user already gone is the expected state on a re-run, not a failure.
		if (authError && !/not found/i.test(authError.message)) {
			throw new Error(`purge: could not delete auth user for ${affiliateId}: ${authError.message}`);
		}

		authUserDeleted = true;
	}

	// Everything the affiliate produced or accumulated.
	// `as const` keeps these as literal table names: the typed client checks
	// each one exists and carries an affiliate_id, so a rename in the schema
	// breaks the build instead of silently leaving rows behind on a purge.
	for (const table of [
		"notifications",
		"feedback",
		"referral_visits",
		"referral_clicks",
		"affiliate_invites",
		"affiliate_slug_aliases",
	] as const) {
		const { error: rowError } = await db().from(table).delete().eq("affiliate_id", affiliateId);
		if (rowError) throw new Error(`purge: could not clear ${table} for ${affiliateId}: ${rowError.message}`);
	}

	// What is left of the row. The slug is rotated rather than blanked: it is
	// `not null` and unique, it is the `?r=` anybody may still have printed, and
	// leaving the old one in place would keep crediting visits to an account
	// that no longer exists. A random one cannot be guessed back to the person.
	const { error: blankError } = await db()
		.from("affiliates")
		.update({
			slug: `deleted-${randomBytes(6).toString("hex")}`,
			display_name: ERASED_NAME,
			first_name: null,
			last_name: null,
			user_id: null,
			lite_telegram_url: null,
			avatar_path: null,
			notes: null,
			// Revoked, not active. Nothing can sign in as this row any more and
			// the admin list should say so rather than showing a live affiliate
			// with a blank name.
			status: "revoked",
			slug_changed_at: new Date().toISOString(),
			onboarding: {},
			notification_prefs: {},
		})
		.eq("id", affiliateId);

	if (blankError) {
		throw new Error(`purge: could not blank affiliate ${affiliateId}: ${blankError.message}`);
	}

	// The audit trail is deliberately not cleared. Its foreign key is
	// `on delete set null`, so those rows have already stopped naming anybody —
	// what survives is "an account was deleted on this date", which is the
	// record that the erasure happened and the one thing worth keeping.
	return { affiliateId, authUserDeleted };
}
