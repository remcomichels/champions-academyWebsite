/**
 * The affiliate's activity inbox. Scoped by session like every route here.
 */
export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);

	const [recent, unread] = await Promise.all([
		db().from("notifications")
			.select("id, kind, payload, read_at, created_at")
			.eq("affiliate_id", affiliate.id)
			.order("id", { ascending: false })
			.limit(30),

		db().from("notifications").select("*", { count: "exact", head: true })
			.eq("affiliate_id", affiliate.id)
			.is("read_at", null),
	]);

	return {
		items: (recent.data ?? []).map(row => ({
			id: Number(row.id),
			kind: row.kind as string,
			payload: row.payload as Record<string, unknown>,
			read: Boolean(row.read_at),
			createdAt: row.created_at as string,
		})),
		unread: unread.count ?? 0,
	};
});
