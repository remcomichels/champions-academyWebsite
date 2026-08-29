import { int, object, optional } from "../utils/validate";

/**
 * Published changelog entries, newest first.
 *
 * Requires a session but not an affiliate profile: an admin-only login should
 * be able to read the notes for the thing they are running. Drafts — rows with
 * a null `published_at` — are filtered here rather than in the page, so an
 * unpublished entry never reaches a browser at all.
 */
export default defineEventHandler(async (event) => {
	const session = await getAuthSession(event);

	if (!session) {
		throw createError({ statusCode: 401, statusMessage: "Sign in to read the changelog" });
	}

	const query = await getValidatedQuery(event, object({
		limit: optional(int({ min: 1, max: 100 })),
	}));

	const { data, error } = await db()
		.from("changelog")
		.select("id, published_at, title, body")
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
		entries: (data ?? []).map(row => ({
			id: row.id,
			at: row.published_at,
			title: row.title,
			body: row.body,
		})),
	};
});
