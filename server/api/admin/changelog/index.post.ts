import { object, oneOf, optional, str } from "../../../utils/validate";
import { CHANGELOG_KINDS } from "#shared/types/changelog";

/**
 * Writes a changelog entry.
 *
 * Publish-on-write by default, because that is what posting a release note
 * means; `draft: true` holds it back with a null `published_at`.
 *
 * This used to be the only route here, on the reasoning that a changelog is an
 * append-only record and correcting one should cost something. That held while
 * the only reader was signed in; it stopped holding when the changelog became a
 * public page, where a typo or a wrong `kind` is on the website until somebody
 * publishes a correction underneath it. The sibling PATCH and DELETE exist for
 * that, and every one of the three writes an audit row — the trail moves from
 * "the table cannot be rewritten" to "every rewrite is recorded".
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);

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

	await audit(event, {
		actorKind: "admin",
		action: isDraft ? "changelog.drafted" : "changelog.published",
		actorUserId: admin.userId,
		// The id and the kind, not the copy. What an entry says is on the public
		// page already; what the trail is for is who touched which row.
		meta: { entryId: data.id, kind: body.kind },
	});

	return { id: data.id, published: !isDraft };
});
