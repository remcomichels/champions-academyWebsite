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
		.select("id, slug, status, vip_checkout_url, lite_telegram_url, calendly_url")
		.eq("slug", slug)
		.eq("status", "active")
		.maybeSingle();

	let row = direct;

	if (!row) {
		const { data: alias } = await db()
			.from("affiliate_slug_aliases")
			.select("affiliates!inner(id, slug, status, vip_checkout_url, lite_telegram_url, calendly_url)")
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
		vip: isAllowedLink("vip", row.vip_checkout_url) ? (row.vip_checkout_url as string) : null,
		lite: isAllowedLink("lite", row.lite_telegram_url) ? (row.lite_telegram_url as string) : null,
		calendly: isAllowedLink("calendly", row.calendly_url) ? (row.calendly_url as string) : null,
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
