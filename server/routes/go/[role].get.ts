import type { H3Event } from "h3";
import { REF_COOKIE, REF_COOKIE_OPTIONS } from "../../middleware/referral";
import type { LinkRole, ReferralContext } from "#shared/types/affiliate";

const ROLES: LinkRole[] = ["lite"];

/**
 * The destination behind every managed CTA.
 *
 * A button that used to render the affiliate's Telegram URL straight into the
 * page now points here, and this route decides where the visitor actually
 * goes. Three things fall out of that:
 *
 *  - **The house split.** A visitor who arrived without a `?r=` link is
 *    assigned to one of the owners in the rotation at the moment they click,
 *    and that assignment sticks for 30 days. Doing it here rather than in the
 *    referral middleware is what keeps the marketing pages cacheable: an
 *    anonymous pageview still sets no cookie, so it is still shared CDN
 *    content. It also means the split counts people who showed intent instead
 *    of every crawler that touched the homepage.
 *  - **Clicks are counted server-side.** This replaces the sendBeacon to
 *    /api/public/click, which could be dropped by an ad blocker, fired twice,
 *    or not at all if the page was torn down first. A redirect the browser has
 *    to follow cannot be suppressed without also breaking the link.
 *  - **The URL is validated once more before it is issued.** Both link roles
 *    are affiliate-supplied, and this is the server sending the visitor there
 *    under its own name.
 *
 * Always no-store: it sets cookies, and it answers differently for every
 * visitor.
 */
export default defineEventHandler(async (event) => {
	const role = getRouterParam(event, "role") as LinkRole | undefined;

	markNoStore(event);

	if (!role || !ROLES.includes(role)) {
		throw createError({ statusCode: 404, statusMessage: "Unknown link" });
	}

	// Rate limited on the same terms as the click endpoint it replaces. This is
	// an unauthenticated route that writes two rows, so it gets a ceiling before
	// it touches anything.
	await enforceRateLimit(event, `go:ip:${clientIp(event)}`, {
		limit: 60,
		windowSeconds: 60,
		lockSeconds: 300,
	});

	// A browser prefetching or prerendering the link is not a click. Assigning
	// an owner here would burn the visitor's one-time coin flip on a machine
	// that may never navigate, and would count a visit nobody made. Chrome sends
	// Sec-Purpose; older builds and some others send Purpose or X-Purpose.
	const purpose = `${getRequestHeader(event, "sec-purpose") ?? ""} `
		+ `${getRequestHeader(event, "purpose") ?? ""} `
		+ `${getRequestHeader(event, "x-purpose") ?? ""}`;
	const isPrefetch = /prefetch|prerender|preview/i.test(purpose);

	const day = visitDay();
	const path = event.path.split("?")[0]!;

	let links: ReferralContext | null = null;
	let assigned = false;

	const cookieRef = getCookie(event, REF_COOKIE);

	if (cookieRef && SLUG_RE.test(cookieRef)) {
		links = await resolveAffiliateLinks(cookieRef);
	}

	// No referral of their own: the house rotation takes it.
	if (!links && !isPrefetch) {
		const house = await resolveHouseAffiliates();
		const hash = visitorHash(event, day);

		// Only owners who can actually serve this role are in the draw.
		//
		// Without this, an owner who has not filled in their Telegram link yet
		// still takes their half of the clicks, and those visitors land in the
		// shared default group while being counted as that owner's — a figure
		// that disagrees with where the person actually went. Filtering here
		// means the split follows the links that exist: one owner set up takes
		// everything until the other is, which is visible in the numbers rather
		// than hidden behind them.
		const eligible = house.filter(candidate => isAllowedLink(role, candidate[role]));
		const picked = pickHouseAffiliate(hash, eligible);

		if (picked) {
			links = picked;
			assigned = true;

			setCookie(event, REF_COOKIE, picked.slug, {
				...REF_COOKIE_OPTIONS,
				maxAge: 60 * 60 * 24 * 30,
			});
		}
	}

	// Whatever the visitor ends up with, the destination is checked against the
	// allowed hosts before the redirect is issued.
	const affiliateHref = links?.[role] ?? null;
	let target = isAllowedLink(role, affiliateHref) ? affiliateHref : null;

	if (!target) {
		const defaults = await resolveDefaultLinks();
		target = defaults[role];
	}

	if (!target) {
		// The same outcome the old render-time resolution had when nothing
		// resolved: no destination. Loud rather than silent — a Join button
		// leading nowhere is the failure worth noticing on a launch day.
		throw createError({ statusCode: 404, statusMessage: "No destination configured" });
	}

	if (links && !isPrefetch) {
		recordGo(event, links.affiliateId, role, day, path, assigned);
	}

	// 302, not 301: the destination changes per visitor and per affiliate, and a
	// permanent redirect would be cached by the browser and pin one of them.
	return sendRedirect(event, target, 302);
});

/**
 * Writes the click, and the visit when this request created the assignment.
 *
 * Both inserts are deduped by unique index rather than by checking first, so a
 * repeat is a no-op at the database and the figures stay "unique per visitor
 * per day". Neither is allowed to delay or break the redirect: the visitor is
 * on their way to Telegram and a counting failure is not worth a symptom.
 */
function recordGo(
	event: H3Event,
	affiliateId: string,
	role: LinkRole,
	day: string,
	path: string,
	assigned: boolean,
): void {
	const hash = visitorHash(event, day);

	const writes: PromiseLike<unknown>[] = [
		db()
			.from("referral_clicks")
			.insert({ affiliate_id: affiliateId, day, visitor_hash: hash, role })
			.then(() => {}, () => {}),
	];

	// Only when the house split made the assignment on this request. A visitor
	// who arrived through a real `?r=` link already had their visit recorded by
	// the referral middleware, and counting it again here would double every
	// referred affiliate's figures the moment they clicked anything.
	if (assigned) {
		writes.push(
			db()
				.from("referral_visits")
				.insert({
					affiliate_id: affiliateId,
					day,
					visitor_hash: hash,
					path,
					source: "house",
					referrer_host: null,
					country: getRequestHeader(event, "x-vercel-ip-country") ?? null,
				})
				.then(() => {}, () => {}),
		);
	}

	// Same reason as the referral middleware: a serverless function is frozen
	// the moment the response is written, so a floating promise is dropped.
	if (typeof event.waitUntil === "function") {
		event.waitUntil(Promise.all(writes.map(w => Promise.resolve(w))));
	}
}
