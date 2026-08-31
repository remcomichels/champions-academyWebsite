import { int } from "../../../utils/validate";

/**
 * Removes a changelog entry.
 *
 * A hard delete, not a soft one. The alternative — a `deleted_at` column — buys
 * an undo at the cost of every read in the app having to remember to filter on
 * it, and the one read that forgets puts a deleted entry back on the public
 * page. The row is small, the audit trail records that it went and who took it,
 * and the confirmation step in front of this is where the caution belongs.
 *
 * The title goes into the audit row rather than only the id, because the whole
 * point of an entry that has been deleted is that nothing else can tell you
 * what it said afterwards.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);
	const id = int({ min: 1 })(getRouterParam(event, "id"), "id");

	const { data: existing, error: loadError } = await db()
		.from("changelog")
		.select("id, title, kind, published_at")
		.eq("id", id)
		.maybeSingle();

	if (loadError) throw createError({ statusCode: 503, statusMessage: "Could not load that entry" });

	// Already gone. Answering 404 would make the panel show an error for a
	// button that achieved exactly what it promised.
	if (!existing) return { id, deleted: false };

	const { error } = await db()
		.from("changelog")
		.delete()
		.eq("id", id);

	if (error) {
		throw createError({ statusCode: 503, statusMessage: "That didn't delete. Try again in a moment" });
	}

	await audit(event, {
		actorKind: "admin",
		action: "changelog.deleted",
		actorUserId: admin.userId,
		meta: {
			entryId: id,
			title: existing.title,
			kind: existing.kind,
			wasPublished: existing.published_at !== null,
		},
	});

	return { id, deleted: true };
});
