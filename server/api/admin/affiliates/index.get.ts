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
			lite_telegram_url,
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

	// Counts, live-invite prefixes and pending deletions, batched rather than N+1.
	const [visits, invites, deletions] = await Promise.all([
		ids.length ? db().from("referral_visits").select("affiliate_id").in("affiliate_id", ids) : { data: [] },
		// Every invite for these affiliates, not only the live ones.
		//
		// It used to filter to unredeemed, unrevoked and unexpired here, which
		// answered "is there a code outstanding?" and nothing else. The table
		// now also says whether somebody never had a code, has one waiting, or
		// let one lapse — and "lapsed" is precisely the row that filter threw
		// away. Both facts are derived below from the same rows.
		//
		// Ordered newest first so the first row seen for an affiliate is their
		// most recent invite.
		ids.length
			? db().from("affiliate_invites")
				.select("affiliate_id, code_prefix, expires_at, redeemed_at, revoked_at, created_at")
				.in("affiliate_id", ids)
				.order("created_at", { ascending: false })
			: { data: [] },

		// Affiliates who have asked to be deleted.
		//
		// Surfaced here because nothing else surfaces it. The request writes a
		// row and stops — the queue is deliberately not drained automatically,
		// since erasing somebody is not a thing to do on a timer without a human
		// seeing it — so without this the only trace of somebody asking is a
		// line in their own audit log that no admin screen reads.
		// The settings page tells them 14 days; this is what makes that a
		// deadline somebody can actually meet.
		ids.length
			? db().from("gdpr_requests")
				.select("affiliate_id, execute_after, reason, reason_note")
				.in("affiliate_id", ids)
				.eq("kind", "delete")
				.in("status", ["pending", "ready"])
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

	const visitCounts = tally(visits.data as { affiliate_id: unknown }[]);

	const pendingDeletion = new Map<string, { on: string; reason: string | null; note: string | null }>();
	for (const row of (deletions.data ?? []) as Record<string, unknown>[]) {
		pendingDeletion.set(row.affiliate_id as string, {
			on: row.execute_after as string,
			reason: (row.reason as string | null) ?? null,
			note: (row.reason_note as string | null) ?? null,
		});
	}

	// The HeroFX linkage, in a query of its own rather than in the select above.
	// Those columns arrive with a migration, and naming them in the main select
	// would turn "the migration has not been applied yet" into an admin panel
	// that cannot list anybody. Here it degrades to an empty HeroFX column.
	const herofxById = new Map<string, { code: string | null; source: string | null }>();

	if (ids.length) {
		const { data: links, error: linkError } = await db()
			.from("affiliates")
			.select("id, herofx_code, herofx_code_source")
			.in("id", ids);

		if (linkError) console.error("[herofx] could not read affiliate links:", linkError.message);

		for (const row of links ?? []) {
			herofxById.set(row.id as string, {
				code: (row.herofx_code as string | null) ?? null,
				source: (row.herofx_code_source as string | null) ?? null,
			});
		}
	}

	const now = Date.now();

	const liveInvites = new Map<string, { prefix: string; expiresAt: string }>();
	// The most recent invite per affiliate, whatever became of it — this is what
	// tells "never invited" apart from "invited, and the window closed".
	const latestInvite = new Map<string, { expired: boolean }>();

	for (const row of (invites.data ?? []) as Record<string, unknown>[]) {
		const affiliateId = row.affiliate_id as string;
		const expiresAt = row.expires_at as string;
		const live = !row.redeemed_at && !row.revoked_at && new Date(expiresAt).getTime() > now;

		// Rows arrive newest first, so the first one seen wins. `liveInvite` is
		// still at most one by construction — the partial unique index allows
		// only one unredeemed, unrevoked invite per affiliate.
		if (live && !liveInvites.has(affiliateId)) {
			liveInvites.set(affiliateId, {
				prefix: row.code_prefix as string,
				expiresAt,
			});
		}

		if (!latestInvite.has(affiliateId)) {
			latestInvite.set(affiliateId, { expired: !live });
		}
	}

	return {
		affiliates: (data ?? []).map((row) => {
			const id = row.id as string;
			return {
				id,
				slug: row.slug as string,
				displayName: row.display_name as string,
				status: row.status as string,
				// For the edit form to prefill. Admin-only route, and notes are
				// written by admins about affiliates in the first place.
				notes: row.notes as string | null,
				// Booleans rather than the URLs themselves: the table only needs to
				// show what is set up, and there is no reason to spray every
				// affiliate's links across an admin list.
				hasTelegram: Boolean(row.lite_telegram_url),
				hasLogin: Boolean(row.user_id),
				// The HeroFX partner code whose downline they see, and how it got
				// there: `email` means the sync matched their login address
				// against the feed, `admin` means somebody typed it.
				herofxCode: herofxById.get(id)?.code ?? null,
				herofxCodeSource: (herofxById.get(id)?.source ?? null) as "email" | "admin" | null,
				// Null unless they have asked to be deleted. The date is when the
				// grace period they were promised runs out, and the reason is
				// what they picked on the way out — the only place anyone gets
				// to read it, since the request row goes with the purge.
				pendingDeletion: pendingDeletion.get(id) ?? null,
				createdAt: row.created_at as string,
				visits: visitCounts.get(id) ?? 0,
				liveInvite: liveInvites.get(id) ?? null,
				// Where this affiliate is in getting an account, as one value the
				// table can render as a dot. Derived rather than stored, so it
				// cannot fall out of step with the rows it describes.
				//
				//   active   they have a login and are using it
				//   pending  a code is out and has not been redeemed
				//   expired  a code was issued and the window closed unused
				//   none     never invited
				inviteState: (row.user_id
					? "active"
					: liveInvites.has(id)
						? "pending"
						: latestInvite.has(id)
							? "expired"
							: "none") as "active" | "pending" | "expired" | "none",
			};
		}),
	};
});
