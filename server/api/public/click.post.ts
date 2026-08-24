import { createHash } from "node:crypto";
import { REF_COOKIE } from "../../middleware/referral";
import { object, oneOf } from "../../utils/validate";

/**
 * Records that a referred visitor clicked one of the affiliate's links.
 *
 * The only unauthenticated write in the app besides the Whop webhook, so the
 * rules it follows are worth stating:
 *
 *  - **The affiliate is never taken from the request.** It comes from the
 *    `__Host-ca_ref` cookie, which is httpOnly and was set by our own referral
 *    middleware. A caller cannot credit clicks to somebody else by asking.
 *  - **The role is checked against a fixed list**, so the column cannot be
 *    filled with arbitrary strings.
 *  - **Counted once per person per day per link**, enforced by a unique index
 *    rather than by trusting the caller. Re-clicking does nothing, which keeps
 *    the figure comparable with the visit count it will be divided by.
 *  - **No PII.** The same daily-rotating pseudonymous hash as referral_visits;
 *    no IP or user agent is stored.
 *  - **Always 204.** The response never reveals whether a referral cookie was
 *    present, which affiliate it named, or whether a row was written.
 */
export default defineEventHandler(async (event) => {
	// The referral cookie is SameSite=Lax, so a cross-site POST cannot carry it
	// and this route is already a no-op from another origin. This is the second
	// layer, matching every other state-changing route in the app.
	assertSameOrigin(event);

	// Cheap and first: a flood should be rejected before it touches the database
	// for anything else.
	await enforceRateLimit(event, `click:ip:${clientIp(event)}`, {
		limit: 60,
		windowSeconds: 60,
		lockSeconds: 300,
	});

	const body = await readValidatedBody(event, object({
		role: oneOf("vip", "lite", "calendly"),
	}));

	setResponseStatus(event, 204);
	markNoStore(event);

	const slug = getCookie(event, REF_COOKIE);
	if (!slug) return null;

	const links = await resolveAffiliateLinks(slug);
	if (!links) return null;

	const day = new Date().toISOString().slice(0, 10);
	const pepper = useRuntimeConfig().visitPepper as string;

	const visitorHash = createHash("sha256")
		.update(`${pepper}|${clientIp(event)}|${getRequestHeader(event, "user-agent") ?? ""}|${day}`)
		.digest("hex");

	// A duplicate is the unique index doing its job, not a failure — and a
	// visitor must never see an error because of how we count.
	await db()
		.from("referral_clicks")
		.insert({
			affiliate_id: links.affiliateId,
			day,
			visitor_hash: visitorHash,
			role: body.role,
		})
		.then(() => {}, () => {});

	return null;
});
