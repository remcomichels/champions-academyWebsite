import { object, oneOf, optional, str } from "../../../utils/validate";

/**
 * Every affiliate, for the admin table.
 *
 * Reading an id from the request is fine here in a way it never is under
 * /api/affiliate/: requireAdmin runs first, and an admin is entitled to the
 * whole list by definition.
 */
export default defineEventHandler(async (event) => {
	await requireAdmin(event);

	const query = await getValidatedQuery(event, object({
		q: optional(str({ max: 80 })),
		status: optional(oneOf("active", "revoked")),
	}));

	let builder = db()
		.from("affiliates")
		.select(`
			id, slug, display_name, status,
			whop_username, whop_checkout_configuration_id, vip_checkout_url,
			lite_telegram_url, calendly_url,
			user_id, notes, created_at
		`)
		.order("created_at", { ascending: false });

	if (query.status) builder = builder.eq("status", query.status);
	if (query.q) builder = builder.or(`slug.ilike.%${query.q}%,display_name.ilike.%${query.q}%`);

	const { data, error } = await builder;

	if (error) {
		throw createError({ statusCode: 500, statusMessage: "Could not load affiliates" });
	}

	const ids = (data ?? []).map(row => row.id as string);

	// Counts and live-invite prefixes in two queries rather than N+1.
	const [conversions, visits, invites] = await Promise.all([
		ids.length ? db().from("conversions").select("affiliate_id").in("affiliate_id", ids) : { data: [] },
		ids.length ? db().from("referral_visits").select("affiliate_id").in("affiliate_id", ids) : { data: [] },
		ids.length
			? db().from("affiliate_invites")
				.select("affiliate_id, code_prefix, expires_at")
				.in("affiliate_id", ids)
				.is("redeemed_at", null)
				.is("revoked_at", null)
				// Expiry counts as gone. Without this an unredeemed code that
				// lapsed still reported as outstanding, which hid "Issue code"
				// behind "Revoke code" in the panel — so missing the window meant
				// having to revoke a already-dead code before issuing a live one.
				// The row itself stays put for the audit trail; invite.post.ts
				// revokes whatever is outstanding before inserting, expired
				// included, so the one-live-invite index is never at risk.
				.gt("expires_at", new Date().toISOString())
			: { data: [] },
	]);

	const tally = (rows: { affiliate_id: unknown }[] | null) => {
		const counts = new Map<string, number>();
		for (const row of rows ?? []) {
			const id = row.affiliate_id as string;
			counts.set(id, (counts.get(id) ?? 0) + 1);
		}
		return counts;
	};

	const sales = tally(conversions.data as { affiliate_id: unknown }[]);
	const visitCounts = tally(visits.data as { affiliate_id: unknown }[]);

	const liveInvites = new Map<string, { prefix: string; expiresAt: string }>();
	for (const row of (invites.data ?? []) as Record<string, unknown>[]) {
		liveInvites.set(row.affiliate_id as string, {
			prefix: row.code_prefix as string,
			expiresAt: row.expires_at as string,
		});
	}

	return {
		affiliates: (data ?? []).map((row) => {
			const id = row.id as string;
			return {
				id,
				slug: row.slug as string,
				displayName: row.display_name as string,
				status: row.status as string,
				whopUsername: row.whop_username as string | null,
				// For the edit form to prefill. Admin-only route, and notes are
				// written by admins about affiliates in the first place.
				notes: row.notes as string | null,
				// Booleans rather than the URLs themselves: the table only needs to
				// show what is set up, and there is no reason to spray every
				// affiliate's links across an admin list.
				hasWhopConfig: Boolean(row.whop_checkout_configuration_id),
				hasVipLink: Boolean(row.vip_checkout_url),
				hasTelegram: Boolean(row.lite_telegram_url),
				hasCalendly: Boolean(row.calendly_url),
				hasLogin: Boolean(row.user_id),
				createdAt: row.created_at as string,
				sales: sales.get(id) ?? 0,
				visits: visitCounts.get(id) ?? 0,
				liveInvite: liveInvites.get(id) ?? null,
			};
		}),
	};
});
