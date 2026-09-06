import type { ReferralContext } from "#shared/types/affiliate";

/**
 * The affiliates sharing traffic that arrived without a referral link.
 *
 * Cached on the same terms as resolveAffiliateLinks: this runs on every Join
 * click, and the set changes about as often as somebody becomes an owner.
 */
async function lookup(): Promise<ReferralContext[]> {
	const { data } = await db()
		.from("affiliates")
		.select("id, slug, lite_telegram_url")
		.eq("house_share", true)
		.eq("status", "active")
		// Ordered so the rotation is stable. Without it Postgres may return the
		// rows in any order, and the index a visitor hashes to would point at a
		// different owner between requests — the assignment would stop being
		// sticky for anyone whose cookie was later cleared.
		.order("slug", { ascending: true });

	return (data ?? []).map(row => ({
		affiliateId: row.id as string,
		slug: row.slug as string,
		lite: isAllowedLink("lite", row.lite_telegram_url) ? (row.lite_telegram_url as string) : null,
	}));
}

export const resolveHouseAffiliates = defineCachedFunction(lookup, {
	name: "houseAffiliates",
	maxAge: 300,
	swr: true,
	getKey: () => "all",
});

/**
 * Which of them this visitor gets.
 *
 * Derived from the visitor hash rather than drawn at random, for two reasons.
 * The same visitor lands on the same owner even if their cookie is cleared,
 * so refreshing cannot shop for a different group. And the assignment is
 * reproducible from a row that is already stored, which is what makes a
 * disputed split checkable afterwards rather than a matter of trust.
 *
 * The hash is already uniformly distributed, so the low bits are as good a
 * source as any and the division comes out even over any real volume. It will
 * not be exactly 50/50 on a given day — that is sampling, not a bug, and an
 * exact alternating counter would need shared state that serverless instances
 * do not have.
 */
export function pickHouseAffiliate<T>(hash: string, candidates: T[]): T | null {
	if (!candidates.length) return null;

	// The last 8 hex characters, which is 32 bits — comfortably more spread
	// than the number of owners will ever need.
	const slice = Number.parseInt(hash.slice(-8), 16);
	if (!Number.isFinite(slice)) return candidates[0] ?? null;

	return candidates[slice % candidates.length] ?? null;
}
