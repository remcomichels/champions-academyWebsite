/**
 * Signs the affiliate out everywhere except here.
 *
 * Takes no session id. The only useful action is "end all the others", and
 * accepting an id would mean reading an identifier from the request in a
 * directory where that is exactly what we don't do.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);
	const session = await requireUser(event);

	const { data, error } = await db()
		.from("sessions")
		.delete()
		.eq("user_id", session.userId)
		.neq("id", session.sessionId)
		.select("id");

	if (error) throw createError({ statusCode: 500, statusMessage: "Could not sign out the other sessions" });

	await audit(event, {
		actorKind: "affiliate",
		action: "sessions.revoked_others",
		actorUserId: session.userId,
		subjectAffiliateId: affiliate.id,
		meta: { count: data?.length ?? 0 },
	});

	return { signedOut: data?.length ?? 0 };
});
