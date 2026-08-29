/**
 * Marks the affiliate's notifications as read.
 *
 * Takes no ids — it marks everything unread for the caller. There is nothing
 * useful to do with a per-id API here, and accepting ids would mean accepting
 * identifiers from the request in a directory where that is exactly what we
 * do not do.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);

	await db()
		.from("notifications")
		.update({ read_at: new Date().toISOString() })
		.eq("affiliate_id", affiliate.id)
		.is("read_at", null);

	setResponseStatus(event, 204);
	return null;
});
