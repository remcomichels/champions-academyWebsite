import { int, object, optional } from "../utils/validate";
import type { ChangelogEntry, ChangelogKind } from "#shared/types/changelog";

/**
 * Published changelog entries, newest first.
 *
 * Public, and signed-out on purpose: this feeds /changelog, which is a page
 * anyone can open. It carries nothing personal — every row is release notes an
 * admin wrote for publication — so a session check here would only have made
 * the page impossible without protecting anything.
 *
 * Drafts (a null `published_at`) and future-dated entries are filtered here
 * rather than in the page, so an unpublished entry never reaches a browser at
 * all. That is the whole access control this endpoint needs.
 */
export default defineEventHandler(async (event) => {
	const query = await getValidatedQuery(event, object({
		limit: optional(int({ min: 1, max: 100 })),
	}));

	const { data, error } = await db()
		.from("changelog")
		.select("id, published_at, kind, title, body")
		.not("published_at", "is", null)
		// Future-dated entries are scheduled, not published — the partial index
		// covers the null case and this covers the rest.
		.lte("published_at", new Date().toISOString())
		.order("published_at", { ascending: false })
		.limit(query.limit ?? 50);

	if (error) {
		throw createError({ statusCode: 503, statusMessage: "The changelog is temporarily unavailable" });
	}

	return {
		entries: (data ?? []).map((row): ChangelogEntry => ({
			id: row.id,
			at: row.published_at,
			kind: row.kind as ChangelogKind,
			title: row.title,
			body: row.body,
		})),
	};
});
