import type { ReferralContext } from "#shared/types/affiliate";

/**
 * Looks up an affiliate by their public slug and returns their links.
 *
 * Cached for five minutes because this runs on every referred page view. The
 * cost is that revoking an affiliate takes up to five minutes to stop swapping
 * links — acceptable, but worth knowing during an incident. Their dashboard
 * access is cut immediately regardless, since that path does not use this
 * cache.
 */
async function lookup(slug: string): Promise<ReferralContext | null> {
	// Try the live slug first, then any alias still inside its grace period.
	// Aliases exist so a slug change does not break links already printed on a
	// QR code or spoken in a video.
	const { data: direct } = await db()
		.from("affiliates")
		.select("id, slug, status, lite_telegram_url")
		.eq("slug", slug)
		.eq("status", "active")
		.maybeSingle();

	let row = direct;

	if (!row) {
		const { data: alias } = await db()
			.from("affiliate_slug_aliases")
			.select("affiliates!inner(id, slug, status, lite_telegram_url)")
			.eq("slug", slug)
			.gt("expires_at", new Date().toISOString())
			.maybeSingle();

		const joined = alias?.affiliates as unknown as typeof direct | undefined;
		row = joined && joined.status === "active" ? joined : null;
	}

	if (!row) return null;

	return {
		affiliateId: row.id as string,
		// The canonical slug, not the alias that was requested — so the cookie
		// and every later lookup settle on one value.
		slug: row.slug as string,
		lite: isAllowedLink("lite", row.lite_telegram_url) ? (row.lite_telegram_url as string) : null,
	};
}

export const resolveAffiliateLinks = defineCachedFunction(lookup, {
	name: "affiliateLinks",
	maxAge: 300,
	swr: true,
	// Keyed on the slug and nothing else. A key derived from anything shared
	// between visitors would serve one affiliate's links to another's traffic.
	getKey: (slug: string) => slug,
});

/**
 * Drops an affiliate's cached links so a status change lands immediately.
 *
 * Without this, revoking someone leaves their links being served for up to the
 * five-minute TTL — and `swr` means the first request after that still gets the
 * stale value while it revalidates. The window is small and nothing is sold
 * through those links, but "revoked" should mean revoked.
 *
 * Matched by suffix rather than by rebuilding Nitro's key. That key is
 * `base:group:name:key.json` with a default base and group this code does not
 * set, and unstorage normalises the result again on the way in — reconstructing
 * it means encoding two layers of someone else's internals, which break quietly
 * on a minor upgrade. The suffix is just our own name and slug.
 *
 * Best-effort by design: a failure here leaves the TTL as the backstop, which
 * is exactly where we were before, so it must never fail a status change.
 */
export async function invalidateAffiliateLinks(affiliateId: string, slug: string): Promise<void> {
	try {
		// Aliases resolve through the same cache under their own slug, so a
		// renamed affiliate has more than one entry pointing at them.
		const { data: aliases } = await db()
			.from("affiliate_slug_aliases")
			.select("slug")
			.eq("affiliate_id", affiliateId);

		const slugs = new Set([slug, ...(aliases ?? []).map(row => row.slug as string)]);

		const storage = useStorage("cache");
		const keys = await storage.getKeys();

		await Promise.all(
			keys
				.filter(key => [...slugs].some(s => key.endsWith(`affiliateLinks:${s}.json`)))
				.map(key => storage.removeItem(key)),
		);
	}
	catch {
		// Swallowed on purpose. See above.
	}
}
