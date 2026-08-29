import { displayName, object, optional, str } from "../../utils/validate";

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
		firstName: optional(displayName({ max: 80 })),
		lastName: optional(displayName({ max: 80 })),
		timezone: optional(str({ max: 64 })),
		locale: optional(str({ max: 10 })),
	}));

	const update: Record<string, unknown> = {};

	// The two parts are written together, and `display_name` is composed from
	// them rather than sent by the client.
	//
	// Composed here rather than in the browser because it is the column half the
	// dashboard reads, and a client that posted its own version could put
	// anything in it — a name that does not match the parts beside it, or an
	// empty string into a NOT NULL column. Reading the missing half off the
	// current row means sending only a last name still produces a whole name.
	if (body.firstName !== undefined || body.lastName !== undefined) {
		const first = (body.firstName ?? affiliate.first_name ?? "").trim();
		const last = (body.lastName ?? affiliate.last_name ?? "").trim();

		// `display_name` is NOT NULL and at least one character, so there has to
		// be something to build it from. The last name is optional — plenty of
		// people have one name — but the first cannot be.
		if (!first) {
			throw createError({
				statusCode: 400,
				statusMessage: "A first name is required",
				data: { field: "firstName", message: "Tell us what to call you" },
			});
		}

		update.first_name = first;
		update.last_name = last || null;
		update.display_name = last ? `${first} ${last}` : first;
	}

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
