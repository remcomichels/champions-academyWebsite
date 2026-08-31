import { object, oneOf, optional, str } from "../../utils/validate";
import { CHANGELOG_KINDS } from "#shared/types/changelog";

/**
 * Writes a changelog entry.
 *
 * Publish-on-write by default, because that is what posting a release note
 * means; `draft: true` holds it back with a null `published_at`. There is no
 * edit or delete route yet — a changelog is an append-only record of what
 * happened, and correcting one is rare enough to be worth doing deliberately
 * rather than having a button for.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	await requireAdmin(event);

	const body = await readValidatedBody(event, object({
		title: str({ min: 1, max: 140 }),
		body: str({ min: 1, max: 8000 }),
		// Required, with no default. The column's default was dropped in
		// 20260831122118 for the same reason: an entry filed under the wrong
		// kind is worse than one that refused to save, because nothing after
		// the write will ever notice it.
		kind: oneOf(...CHANGELOG_KINDS),
		draft: optional(str({ max: 5 })),
	}));

	const isDraft = body.draft === "true";

	const { data, error } = await db()
		.from("changelog")
		.insert({
			title: body.title.trim(),
			body: body.body.trim(),
			kind: body.kind,
			published_at: isDraft ? null : new Date().toISOString(),
		})
		.select("id")
		.single();

	if (error) {
		throw createError({ statusCode: 503, statusMessage: "That didn't save. Try again in a moment" });
	}

	return { id: data.id, published: !isDraft };
});
