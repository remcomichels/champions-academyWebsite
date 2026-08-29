import type { H3Event } from "h3";

/**
 * The origin an affiliate's referral link points at.
 *
 * Always prefers the configured site URL, including in development. This is
 * the canonical public address of the site, and a referral link is something
 * an affiliate copies into a video, a bio or a QR code — it must never be
 * whatever host happened to serve the dashboard. A link built from a preview
 * deploy would send their traffic to a URL that stops existing.
 *
 * The request origin is only a fallback for when NUXT_PUBLIC_SITE_URL is unset
 * or unparseable. Note it is unreliable on its own: the dashboard fetches this
 * data through an internal SSR $fetch, which carries no real Host header, so
 * getRequestURL() there reports `http://localhost` with no port.
 */
export function siteOrigin(event: H3Event): string {
	const configured = process.env.NUXT_PUBLIC_SITE_URL;

	if (configured) {
		try {
			return new URL(configured).origin;
		}
		catch {
			// Misconfigured — fall through rather than hand back a broken link.
		}
	}

	return getRequestURL(event).origin;
}

/** The full `?r=` link an affiliate shares. */
export function referralUrl(event: H3Event, slug: string): string {
	const url = new URL(siteOrigin(event));
	url.searchParams.set("r", slug);
	return url.toString();
}
