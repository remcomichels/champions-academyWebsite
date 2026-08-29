import { createHash } from "node:crypto";
import type { H3Event } from "h3";

/**
 * Referral capture.
 *
 * `?r=<slug>` sets a 30-day cookie and then redirects to the same URL without
 * the parameter. The redirect is not cosmetic:
 *
 *  - the slug otherwise leaks into analytics, the Referer header, and every
 *    URL the visitor copies and pastes;
 *  - `/` and `/?r=x` are two separate CDN entries, so the visitor's *second*
 *    pageview (cookie set, clean URL) would hit the shared cached `/` and see
 *    default links — the swap would silently die after one page.
 *
 * Personalised responses are marked `noStore` so the CDN never caches one
 * affiliate's links and serves them to everyone else.
 */

export const REF_COOKIE = "__Host-ca_ref";

const REF_COOKIE_OPTIONS = {
	// Nothing in the browser reads this. Resolution is entirely server-side,
	// so XSS cannot rewrite attribution and third-party scripts cannot see
	// which affiliate sent the visitor.
	httpOnly: true,
	secure: true,
	sameSite: "lax",
	path: "/",
} as const;

/**
 * Records one visit per visitor per affiliate per day.
 *
 * Runs only on the `?r=` request, which is already a bodyless redirect, so
 * normal pageviews pay nothing. The unique index turns a repeat into a no-op,
 * which is why the metric is "unique daily visits" rather than a raw click
 * count that anyone could inflate by refreshing.
 */
function logVisit(event: H3Event, affiliateId: string, path: string): void {
	const day = new Date().toISOString().slice(0, 10);
	const pepper = useRuntimeConfig().visitPepper as string;

	// Pseudonymous and rotates daily. No IP or user agent is ever stored.
	const visitorHash = createHash("sha256")
		.update(`${pepper}|${clientIp(event)}|${getRequestHeader(event, "user-agent") ?? ""}|${day}`)
		.digest("hex");

	let referrerHost: string | null = null;
	try {
		const referer = getRequestHeader(event, "referer");
		if (referer) referrerHost = new URL(referer).hostname;
	}
	catch {
		// A malformed Referer is the sender's problem, not ours.
	}

	const write = db()
		.from("referral_visits")
		.insert({
			affiliate_id: affiliateId,
			day,
			visitor_hash: visitorHash,
			path,
			referrer_host: referrerHost,
			country: getRequestHeader(event, "x-vercel-ip-country") ?? null,
		})
		.then(() => {}, () => {});

	// A serverless function is frozen the moment the response is written, so a
	// bare floating promise is silently dropped. waitUntil is the only way this
	// reliably lands. Analytics must never delay or break a pageview either way.
	//
	// Promise.resolve because the Supabase builder's `.then()` yields a
	// PromiseLike, and waitUntil takes a real Promise.
	if (typeof event.waitUntil === "function") event.waitUntil(Promise.resolve(write));
}

export default defineEventHandler(async (event) => {
	const path = event.path.split("?")[0]!;

	// Never touch API routes or build assets. The webhook in particular must
	// not be redirected or have a cookie set on it.
	if (
		path.startsWith("/api/")
		|| path.startsWith("/_nuxt/")
		|| path.startsWith("/_ipx/")
		|| path.startsWith("/__nuxt")
	) return;

	const query = getQuery(event);

	// Inside the Storyblok visual editor, a 302 breaks click-to-edit. Skip
	// entirely rather than half-working.
	if (query._storyblok !== undefined) return;

	const rawRef = typeof query.r === "string" ? query.r.toLowerCase().trim() : null;

	if (rawRef) {
		if (SLUG_RE.test(rawRef)) {
			const links = await resolveAffiliateLinks(rawRef);

			if (links) {
				setCookie(event, REF_COOKIE, links.slug, {
					...REF_COOKIE_OPTIONS,
					maxAge: 60 * 60 * 24 * 30,
				});
				event.context.referral = links;
				logVisit(event, links.affiliateId, path);
			}
		}

		// Redirect whether or not the slug resolved. A uniform response means an
		// attacker cannot tell a real affiliate slug from a fake one by probing.
		const rest = new URLSearchParams(query as Record<string, string>);
		rest.delete("r");
		const qs = rest.toString();

		// Must be set before sendRedirect, which writes headers straight to the
		// socket — the beforeResponse hook would run too late. A cached 302 here
		// would stop later visitors on the same link ever reaching the server,
		// silently undercounting visits, and would cache a Set-Cookie with it.
		markNoStore(event);

		return sendRedirect(event, `${path}${qs ? `?${qs}` : ""}`, 302);
	}

	const cookieRef = getCookie(event, REF_COOKIE);

	if (cookieRef && SLUG_RE.test(cookieRef)) {
		const links = await resolveAffiliateLinks(cookieRef);

		if (links) {
			event.context.referral = links;
		}
		else {
			// Affiliate revoked, paused, or deleted since the cookie was set.
			deleteCookie(event, REF_COOKIE, REF_COOKIE_OPTIONS);

			// This response carries a Set-Cookie that clears attribution. Its
			// body is identical to an anonymous visit, so it would otherwise be
			// cacheable — and a CDN replaying that header to other visitors
			// would wipe the referral cookie of every affiliate's traffic.
			markNoStore(event);
		}
	}

	// Single source of truth: the response is personalised if and only if a
	// referral resolved, so these two facts cannot drift apart.
	if (event.context.referral) markNoStore(event);
});
