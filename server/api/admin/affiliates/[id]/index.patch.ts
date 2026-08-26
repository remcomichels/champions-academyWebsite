import { displayName, object, optional, str, uuid } from "../../../../utils/validate";

/**
 * Edits an affiliate.
 *
 * Everything an admin set at creation, changeable afterwards. Fields are
 * optional individually — an omitted key is left alone rather than cleared, so
 * the panel can send only what changed and a future field cannot silently blank
 * an existing value.
 *
 * The slug is the one that carries weight. Renaming reuses exactly what the
 * affiliate's own rename does (server/utils/slug.ts): the retired slug keeps
 * resolving for the grace period so printed links survive, and the new one is
 * checked against both affiliates and live aliases.
 *
 * What it deliberately does not reuse is the 30-day cooldown. That exists to
 * stop an affiliate churning their own link; it is not a rule the owner needs
 * to be held to when fixing a typo. `slug_changed_at` is still stamped, because
 * the cooldown's real reason — every rename leaves another alias behind — is
 * true whoever performed it.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);
	const affiliateId = uuid()(getRouterParam(event, "id"), "id");

	const body = await readValidatedBody(event, object({
		slug: optional(str({ min: 2, max: 32 })),
		displayName: optional(displayName({ min: 1, max: 80 })),
		whopUsername: optional(str({ max: 60 })),
		notes: optional(str({ max: 1000 })),
	}));

	const { data: affiliate, error: loadError } = await db()
		.from("affiliates")
		.select("id, slug, display_name, whop_username, notes")
		.eq("id", affiliateId)
		.maybeSingle();

	if (loadError) throw createError({ statusCode: 500, statusMessage: "Could not load affiliate" });
	if (!affiliate) throw createError({ statusCode: 404, statusMessage: "Affiliate not found" });

	const previousSlug = affiliate.slug as string;
	const update: Record<string, unknown> = {};

	// `optional()` maps "" to null, which is how a nullable field is cleared.
	// Display name is not nullable, so an empty one is a mistake rather than an
	// instruction — the min:1 above rejects it before this.
	if (body.displayName !== null) update.display_name = body.displayName;
	if (body.whopUsername !== undefined) update.whop_username = body.whopUsername;
	if (body.notes !== undefined) update.notes = body.notes;

	let aliasExpiresAt: string | null = null;
	const slug = body.slug === null ? null : normalizeSlug(body.slug);
	const renaming = slug !== null && slug !== previousSlug;

	if (renaming) {
		if (!SLUG_RE.test(slug)) {
			throw createError({
				statusCode: 400,
				statusMessage: "Use 2–32 lowercase letters, numbers and dashes, not starting or ending with a dash",
				data: { field: "slug", message: "Lowercase letters, numbers and dashes only" },
			});
		}

		await assertSlugAvailable(slug, affiliateId);
		aliasExpiresAt = await reserveSlugAlias(previousSlug, affiliateId);

		update.slug = slug;
		update.slug_changed_at = new Date().toISOString();
	}

	if (!Object.keys(update).length) {
		return { id: affiliateId, changed: false };
	}

	const { data, error } = await db()
		.from("affiliates")
		.update(update)
		.eq("id", affiliateId)
		.select("id, slug, display_name, whop_username, notes")
		.maybeSingle();

	if (error) {
		// The unique index is the backstop for a slug that was free a moment ago
		// and is not any more.
		if (error.code === "23505") {
			throw createError({
				statusCode: 409,
				statusMessage: "That link is already taken",
				data: { field: "slug", message: "Already taken" },
			});
		}
		throw createError({ statusCode: 400, statusMessage: "Could not save those changes" });
	}

	if (renaming) {
		// Both slugs: the cache holds an entry under the old name that now points
		// at a rename that has already happened, and possibly a miss under the
		// new one from someone who tried it early.
		await invalidateAffiliateLinks(affiliateId, previousSlug);
		await invalidateAffiliateLinks(affiliateId, slug!);
	}

	await audit(event, {
		actorKind: "admin",
		action: "affiliate.updated",
		actorUserId: admin.userId,
		subjectAffiliateId: affiliateId,
		// Field names, and the slug move because it changes a public URL.
		// Nothing else's contents — notes are free text about a person.
		meta: {
			fields: Object.keys(update).join(", "),
			...(renaming ? { slugFrom: previousSlug, slugTo: slug! } : {}),
		},
	});

	return {
		id: affiliateId,
		changed: true,
		slug: data!.slug as string,
		displayName: data!.display_name as string,
		whopUsername: data!.whop_username as string | null,
		notes: data!.notes as string | null,
		...(renaming ? { previousSlug, previousWorksUntil: aliasExpiresAt } : {}),
	};
});
