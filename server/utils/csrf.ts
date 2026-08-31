import type { H3Event } from "h3";

/**
 * Same-origin check for state-changing requests.
 *
 * Our session cookie is `SameSite=Lax`, which already blocks cross-site POSTs
 * from forms and fetch. This is the second layer: it catches the cases Lax
 * does not cover cleanly (some navigations, older browsers) and costs one
 * header comparison.
 */
export function assertSameOrigin(event: H3Event): void {
	const origin = getRequestHeader(event, "origin");

	// A state-changing request with no Origin is not something a browser sends.
	// Reject rather than guess.
	if (!origin) {
		throw createError({ statusCode: 403, statusMessage: "Missing Origin header" });
	}

	const host = getRequestHeader(event, "host");
	if (!host) {
		throw createError({ statusCode: 403, statusMessage: "Missing Host header" });
	}

	let originHost: string;
	try {
		originHost = new URL(origin).host;
	}
	catch {
		throw createError({ statusCode: 403, statusMessage: "Malformed Origin header" });
	}

	if (originHost !== host) {
		throw createError({ statusCode: 403, statusMessage: "Cross-origin request refused" });
	}
}

/**
 * Client IP.
 *
 * `xForwardedFor` is only trustworthy because the platform in front of us
 * overwrites that header rather than appending to it. If this ever moves off
 * Vercel, revisit — a spoofable IP turns every per-IP throttle into decoration.
 */
export function clientIp(event: H3Event): string {
	return getRequestIP(event, { xForwardedFor: true }) ?? "0.0.0.0";
}
