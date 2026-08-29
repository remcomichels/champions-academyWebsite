import { object, optional, str } from "../../utils/validate";
import { allowedHostsFor } from "#shared/utils/isAllowedLink";

/**
 * Saves the two links an affiliate supplies themselves.
 *
 * These are the only affiliate-controlled values that end up as an `href` on
 * the public marketing site, so the host allow-list is enforced here as well
 * as in the database CHECK constraint and again at render time.
 *
 * The VIP link is deliberately absent: it is generated from Whop during
 * onboarding and there is no path for an affiliate to set it.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);

	const body = await readValidatedBody(event, object({
		// Empty string clears the field, which is how an affiliate removes a
		// link rather than being stuck with a typo forever.
		liteTelegramUrl: optional(str({ max: 500 })),
		calendlyUrl: optional(str({ max: 500 })),
	}));

	const reject = (field: string, role: "lite" | "calendly") =>
		createError({
			statusCode: 400,
			statusMessage: `Must be an https link on ${allowedHostsFor(role).join(" or ")}`,
			data: { field, message: `Must be an https link on ${allowedHostsFor(role).join(" or ")}` },
		});

	if (body.liteTelegramUrl !== null && !isAllowedLink("lite", body.liteTelegramUrl)) {
		throw reject("liteTelegramUrl", "lite");
	}

	if (body.calendlyUrl !== null && !isAllowedLink("calendly", body.calendlyUrl)) {
		throw reject("calendlyUrl", "calendly");
	}

	const { error } = await db()
		.from("affiliates")
		.update({
			lite_telegram_url: body.liteTelegramUrl,
			calendly_url: body.calendlyUrl,
		})
		.eq("id", affiliate.id);

	if (error) {
		// The CHECK constraint is the backstop if validation above ever drifts.
		throw createError({ statusCode: 400, statusMessage: "Could not save those links" });
	}

	await invalidateAffiliateLinks(affiliate.id, affiliate.slug);

	await audit(event, {
		actorKind: "affiliate",
		action: "links.updated",
		subjectAffiliateId: affiliate.id,
		meta: {
			lite: Boolean(body.liteTelegramUrl),
			calendly: Boolean(body.calendlyUrl),
		},
	});

	return {
		links: {
			lite: body.liteTelegramUrl,
			calendly: body.calendlyUrl,
		},
		// The cached entry was just dropped, so the marketing site picks these
		// up on its next request rather than whenever the TTL lapses.
		propagationSeconds: 0,
	};
});
