import { int, object, optional, str } from "../../utils/validate";

/**
 * The feedback inbox, newest first.
 *
 * Read-only, and there is no companion PATCH: nothing about a row changes once
 * it is written. The admin page reads issues and ideas as two lists, so `kind`
 * filters rather than the page splitting one response — that way each list
 * pages independently when there is enough of it to need to.
 */
export default defineEventHandler(async (event) => {
	await requireAdmin(event);

	const query = await getValidatedQuery(event, object({
		kind: optional(str({ max: 8 })),
		limit: optional(int({ min: 1, max: 200 })),
	}));

	if (query.kind && query.kind !== "issue" && query.kind !== "idea") {
		throw createError({ statusCode: 400, statusMessage: "Unknown kind" });
	}

	// The affiliate is joined for the display name only. No email: this is a
	// suggestion box, not a support queue, and nothing here is replied to.
	let builder = db()
		.from("feedback")
		.select("id, created_at, kind, body, affiliates(slug, display_name)")
		.order("created_at", { ascending: false })
		.limit(query.limit ?? 100);

	if (query.kind) builder = builder.eq("kind", query.kind);

	const { data, error } = await builder;

	if (error) {
		throw createError({ statusCode: 503, statusMessage: "Feedback is temporarily unavailable" });
	}

	type Row = {
		id: number;
		created_at: string;
		kind: string;
		body: string;
		affiliates: { slug: string; display_name: string } | null;
	};

	return {
		entries: ((data ?? []) as unknown as Row[]).map(row => ({
			id: row.id,
			at: row.created_at,
			kind: row.kind,
			body: row.body,
			from: row.affiliates
				? { slug: row.affiliates.slug, displayName: row.affiliates.display_name }
				: null,
		})),
	};
});
