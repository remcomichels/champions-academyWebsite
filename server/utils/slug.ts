/**
 * Public `?r=` slug rules, in one place.
 *
 * A slug is not a username. It goes on QR codes, gets read aloud in videos and
 * pasted into bios, so the rules around changing one are less about tidiness
 * than about not breaking links that are already in the wild.
 *
 * The pattern was copied into four files before this existed — the API that
 * creates an affiliate, the one that renames them, the referral middleware, and
 * the database CHECK constraint. Three of those are now this constant. The
 * fourth is the constraint itself, which has to stay a literal in SQL; it is
 * the backstop, so a drift there fails the write rather than letting a bad slug
 * through.
 */

/** Matches the CHECK constraint on affiliates.slug. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/;

/** How long a retired slug keeps resolving after a rename. */
export const ALIAS_GRACE_DAYS = 90;

/** Lowercased and trimmed, the way it will be stored. */
export function normalizeSlug(input: string): string {
	return input.toLowerCase().trim();
}

/**
 * Throws unless `slug` is free for this affiliate to take.
 *
 * Two ways to be taken: held by another affiliate — including the reserved
 * names seeded as revoked rows — or still held by somebody else's alias inside
 * its grace period. Their own alias does not block them, so renaming back to a
 * previous slug works.
 */
export async function assertSlugAvailable(slug: string, affiliateId: string): Promise<void> {
	const taken = () =>
		createError({
			statusCode: 409,
			statusMessage: "That link is already taken",
			data: { field: "slug", message: "Already taken" },
		});

	const { data: clash } = await db()
		.from("affiliates")
		.select("id")
		.eq("slug", slug)
		.maybeSingle();

	if (clash && clash.id !== affiliateId) throw taken();

	const { data: aliasClash } = await db()
		.from("affiliate_slug_aliases")
		.select("affiliate_id")
		.eq("slug", slug)
		.gt("expires_at", new Date().toISOString())
		.maybeSingle();

	if (aliasClash && aliasClash.affiliate_id !== affiliateId) throw taken();
}

/**
 * Keeps `previous` resolving to this affiliate for the grace period.
 *
 * Called before the rename, never after. If this succeeds and the rename then
 * fails, the affiliate keeps their current slug and gains a redundant alias
 * pointing at themselves, which is harmless. The other order briefly orphans
 * every link already printed.
 */
export async function reserveSlugAlias(previous: string, affiliateId: string): Promise<string> {
	const expiresAt = new Date(Date.now() + ALIAS_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

	const { error } = await db()
		.from("affiliate_slug_aliases")
		.upsert(
			{ slug: previous, affiliate_id: affiliateId, expires_at: expiresAt },
			{ onConflict: "slug" },
		);

	if (error) {
		throw createError({ statusCode: 500, statusMessage: "Could not reserve the old link" });
	}

	return expiresAt;
}
