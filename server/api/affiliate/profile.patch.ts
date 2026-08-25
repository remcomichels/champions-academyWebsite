import { object, optional, str } from "../../utils/validate";

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
		// Asked of ICU rather than matched against a pattern. The old regex
		// tested the *shape* of the name, which let `Foo/Bar` through to
		// Postgres — where `at time zone` raises — while turning away real
		// zones that do not look like `Area/City`. It also normalises the
		// casing, so the stored value is the canonical spelling.
		const timezone = canonicalTimezone(body.timezone);

		if (!timezone) {
			throw createError({
				statusCode: 400,
				statusMessage: "That isn't a timezone we recognise",
				data: { field: "timezone", message: "Pick one from the list — search for a city, or UTC" },
			});
		}
		update.timezone = timezone;
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
