import type { H3Event } from "h3";

/**
 * Marks a response as personalised and uncacheable.
 *
 * Sets the headers immediately *and* flags the event. Both are needed:
 *
 *  - `sendRedirect()` writes headers to the socket right away, so the
 *    `beforeResponse` hook in server/plugins/cacheControl.ts runs too late to
 *    change them. Anything that redirects must call this first.
 *  - Normal rendered responses go through the hook, which re-applies these
 *    headers after route rules have had their say.
 *
 * `Vary: Cookie` is deliberately not used — Vercel's edge cache does not
 * honour it for personalisation.
 */
export function markNoStore(event: H3Event): void {
	event.context.noStore = true;

	setResponseHeader(event, "cache-control", "private, no-store, max-age=0, must-revalidate");
	setResponseHeader(event, "cdn-cache-control", "no-store");
	setResponseHeader(event, "vercel-cdn-cache-control", "no-store");
}
