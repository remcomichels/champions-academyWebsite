import type { AdminChangelogEntry, ChangelogKind } from "#shared/types/changelog";

/**
 * Every changelog entry, drafts included, newest first.
 *
 * Separate from the public `/api/changelog` because the two answer different
 * questions. That one answers "what has shipped", and filtering drafts out of
 * it is a security boundary. This one answers "what is in the table", which is
 * the only useful question for a panel whose job is to edit and delete rows —
 * a draft you cannot see is a draft you cannot publish or throw away, which is
 * what the Save as draft button quietly created before this existed.
 *
 * Drafts first, then published newest-first. A draft is unfinished business —
 * it is the row most likely to be what you opened this page to deal with, and
 * sorting it into the middle of the published run by its write date would hide
 * it among entries that need nothing.
 */
export default defineEventHandler(async (event) => {
	await requireAdmin(event);

	const { data, error } = await db()
		.from("changelog")
		.select("id, created_at, published_at, kind, title, body")
		.order("published_at", { ascending: false, nullsFirst: true })
		.order("created_at", { ascending: false })
		.limit(200);

	if (error) {
		throw createError({ statusCode: 503, statusMessage: "The changelog is temporarily unavailable" });
	}

	return {
		entries: (data ?? []).map((row): AdminChangelogEntry => ({
			id: row.id,
			at: row.published_at,
			createdAt: row.created_at,
			kind: row.kind as ChangelogKind,
			title: row.title,
			body: row.body,
			published: row.published_at !== null,
		})),
	};
});
