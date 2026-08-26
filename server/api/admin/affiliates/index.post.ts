import { displayName, object, optional, str } from "../../../utils/validate";

/**
 * Creates an affiliate.
 *
 * The slug becomes their public `?r=` value and goes on links they may print
 * or read aloud, so it is normalised and checked here rather than left to the
 * database to reject after the fact.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);

	const body = await readValidatedBody(event, object({
		slug: str({ min: 2, max: 32 }),
		displayName: displayName({ min: 1, max: 80 }),
		// Their Whop username, for commission attribution on Whop's side.
		// Optional: an affiliate can be created before that is known.
		whopUsername: optional(str({ max: 60 })),
		notes: optional(str({ max: 1000 })),
	}));

	const slug = normalizeSlug(body.slug);

	if (!SLUG_RE.test(slug)) {
		throw createError({
			statusCode: 400,
			statusMessage: "Slug must be 2–32 characters: lowercase letters, numbers and dashes, not starting or ending with a dash",
			data: { field: "slug", message: "Use lowercase letters, numbers and dashes only" },
		});
	}

	const { data, error } = await db()
		.from("affiliates")
		.insert({
			slug,
			display_name: body.displayName,
			whop_username: body.whopUsername,
			notes: body.notes,
			created_by: admin.userId,
		})
		.select("id, slug, display_name, status")
		.single();

	if (error) {
		// Reserved slugs are seeded as revoked rows, so they collide here — which
		// is the intent, but the message should say something useful.
		if (error.code === "23505") {
			throw createError({
				statusCode: 409,
				statusMessage: "That slug is already taken",
				data: { field: "slug", message: "Already taken" },
			});
		}
		throw createError({ statusCode: 400, statusMessage: "Could not create affiliate" });
	}

	await audit(event, {
		actorKind: "admin",
		action: "affiliate.created",
		actorUserId: admin.userId,
		subjectAffiliateId: data.id as string,
		meta: { slug },
	});

	return {
		id: data.id as string,
		slug: data.slug as string,
		displayName: data.display_name as string,
		status: data.status as string,
	};
});
