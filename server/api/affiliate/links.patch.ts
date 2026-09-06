import { object, optional, str } from "../../utils/validate";
import type { LinkRole } from "#shared/types/affiliate";
import { allowedHostsFor } from "#shared/utils/isAllowedLink";

/**
 * Saves the link an affiliate supplies.
 *
 * There were two until the Calendly booking link went with the offer that
 * needed it. This is the only affiliate-controlled value that decides where a
 * visitor is sent from the public marketing site, so the host allow-list is
 * enforced here as well as in the database CHECK constraint and again at the
 * redirect.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);

	const body = await readValidatedBody(event, object({
		// Empty string clears the field, which is how an affiliate removes a
		// link rather than being stuck with a typo forever.
		liteTelegramUrl: optional(str({ max: 500 })),
	}));

	const reject = (field: string, role: LinkRole) =>
		createError({
			statusCode: 400,
			statusMessage: `Must be an https link on ${allowedHostsFor(role).join(" or ")}`,
			data: { field, message: `Must be an https link on ${allowedHostsFor(role).join(" or ")}` },
		});

	if (body.liteTelegramUrl !== null && !isAllowedLink("lite", body.liteTelegramUrl)) {
		throw reject("liteTelegramUrl", "lite");
	}

	const { error } = await db()
		.from("affiliates")
		.update({
			lite_telegram_url: body.liteTelegramUrl,
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
		},
	});

	return {
		links: {
			lite: body.liteTelegramUrl,
		},
		// The cached entry was just dropped, so the marketing site picks these
		// up on its next request rather than whenever the TTL lapses.
		propagationSeconds: 0,
	};
});
