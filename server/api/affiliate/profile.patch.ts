import { object, optional, str } from "../../utils/validate";

/** Timezones the browser reports that we're willing to store verbatim. */
const TIMEZONE_RE = /^[A-Za-z]+\/[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)?$|^UTC$/;

/**
 * Profile and notification preferences.
 *
 * Slug lives in its own route — it is a public identifier with a cooldown and
 * grace period, not a free-text field like the rest of this.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);

	const body = await readValidatedBody(event, object({
		displayName: optional(str({ min: 1, max: 80 })),
		timezone: optional(str({ max: 64 })),
		locale: optional(str({ max: 10 })),
		saleInApp: optional(str({ max: 5 })),
		saleEmail: optional(str({ max: 5 })),
	}));

	const update: Record<string, unknown> = {};

	if (body.displayName) update.display_name = body.displayName;

	if (body.timezone) {
		if (!TIMEZONE_RE.test(body.timezone)) {
			throw createError({
				statusCode: 400,
				statusMessage: "That doesn't look like a timezone",
				data: { field: "timezone", message: "Use a name like Europe/Amsterdam" },
			});
		}
		update.timezone = body.timezone;
	}

	if (body.locale) {
		// Only locales the site actually has. Storing anything else would
		// silently fall back and look broken.
		if (!["en"].includes(body.locale)) {
			throw createError({
				statusCode: 400,
				statusMessage: "That language isn't available yet",
				data: { field: "locale", message: "Only English is available" },
			});
		}
		update.locale = body.locale;
	}

	if (body.saleInApp !== null || body.saleEmail !== null) {
		const current = (affiliate.notification_prefs ?? {}) as Record<string, unknown>;
		update.notification_prefs = {
			...current,
			...(body.saleInApp !== null ? { saleInApp: body.saleInApp === "true" } : {}),
			...(body.saleEmail !== null ? { saleEmail: body.saleEmail === "true" } : {}),
		};
	}

	if (!Object.keys(update).length) {
		return { updated: false };
	}

	const { error } = await db().from("affiliates").update(update).eq("id", affiliate.id);

	if (error) throw createError({ statusCode: 400, statusMessage: "Could not save those changes" });

	await audit(event, {
		actorKind: "affiliate",
		action: "profile.updated",
		subjectAffiliateId: affiliate.id,
		meta: { fields: Object.keys(update).join(",") },
	});

	return { updated: true };
});
