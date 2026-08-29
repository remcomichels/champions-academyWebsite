import { int, object, optional, uuid } from "../../utils/validate";

/** Recent audit entries, newest first. */
export default defineEventHandler(async (event) => {
	await requireAdmin(event);

	const query = await getValidatedQuery(event, object({
		limit: optional(int({ min: 1, max: 200 })),
		affiliateId: optional(uuid()),
	}));

	let builder = db()
		.from("audit_log")
		.select("id, at, actor_kind, action, subject_affiliate_id, ip, meta")
		.order("at", { ascending: false })
		.limit(query.limit ?? 50);

	if (query.affiliateId) builder = builder.eq("subject_affiliate_id", query.affiliateId);

	const { data, error } = await builder;

	if (error) throw createError({ statusCode: 500, statusMessage: "Could not load the audit log" });

	// Resolve slugs in one query rather than per row.
	const ids = [...new Set((data ?? []).map(r => r.subject_affiliate_id).filter(Boolean))] as string[];
	const slugs = new Map<string, string>();

	if (ids.length) {
		const { data: affiliates } = await db().from("affiliates").select("id, slug").in("id", ids);
		for (const row of affiliates ?? []) slugs.set(row.id as string, row.slug as string);
	}

	return {
		entries: (data ?? []).map(row => ({
			id: Number(row.id),
			at: row.at as string,
			actorKind: row.actor_kind as string,
			action: row.action as string,
			affiliateSlug: row.subject_affiliate_id
				? slugs.get(row.subject_affiliate_id as string) ?? null
				: null,
			ip: row.ip as string | null,
			meta: row.meta as Record<string, unknown>,
		})),
	};
});
