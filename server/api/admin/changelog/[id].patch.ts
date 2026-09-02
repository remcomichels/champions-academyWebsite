import { int, object, oneOf, whenPresent, str } from "../../../utils/validate";
import { CHANGELOG_KINDS } from "#shared/types/changelog";
import type { TablesUpdate } from "#server/types/supabase";

/**
 * Edits a changelog entry.
 *
 * `whenPresent` rather than `optional` on every field: an absent key means
 * "leave this alone", so the panel can send only what changed and a future
 * field cannot silently blank an existing value. None of these is clearable —
 * an entry with no title or no body is not a thing — so an empty string is
 * rejected by the length checks rather than stored.
 *
 * `state` moves an entry between draft and published, which is the one edit
 * that changes who can see it. Publishing stamps `published_at` now, so an
 * entry's date is when it went out rather than when it was first typed.
 * Unpublishing nulls it, which takes it off the public page — recorded in the
 * audit trail, because that is a change to what the website says with nothing
 * left behind on the row itself to show it happened.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);
	const id = int({ min: 1 })(getRouterParam(event, "id"), "id");

	const body = await readValidatedBody(event, object({
		title: whenPresent(str({ min: 1, max: 140 })),
		body: whenPresent(str({ min: 1, max: 8000 })),
		kind: whenPresent(oneOf(...CHANGELOG_KINDS)),
		state: whenPresent(oneOf("published", "draft")),
	}));

	const { data: existing, error: loadError } = await db()
		.from("changelog")
		.select("id, published_at")
		.eq("id", id)
		.maybeSingle();

	if (loadError) throw createError({ statusCode: 503, statusMessage: "Could not load that entry" });
	if (!existing) throw createError({ statusCode: 404, statusMessage: "That entry no longer exists" });

	const update: TablesUpdate<"changelog"> = {};

	if (body.title !== undefined) update.title = body.title.trim();
	if (body.body !== undefined) update.body = body.body.trim();
	if (body.kind !== undefined) update.kind = body.kind;

	// Only when it actually moves. Re-saving a published entry from the editor
	// sends `state: "published"` every time, and stamping the date on each of
	// those would walk an entry up the page every time a typo was fixed.
	const wasPublished = existing.published_at !== null;

	if (body.state !== undefined) {
		if (body.state === "published" && !wasPublished) update.published_at = new Date().toISOString();
		if (body.state === "draft" && wasPublished) update.published_at = null;
	}

	if (!Object.keys(update).length) {
		return { id, changed: false };
	}

	const { error } = await db()
		.from("changelog")
		.update(update)
		.eq("id", id);

	if (error) {
		throw createError({ statusCode: 503, statusMessage: "That didn't save. Try again in a moment" });
	}

	await audit(event, {
		actorKind: "admin",
		action: "changelog.updated",
		actorUserId: admin.userId,
		meta: {
			entryId: id,
			// Field names, not their contents — the entry is public, the trail
			// is about who changed what.
			fields: Object.keys(update).join(", "),
		},
	});

	return { id, changed: true };
});
