/**
 * Stops viewing an affiliate's dashboard.
 *
 * Deliberately only requireUser, not requireAdmin. An admin who is demoted
 * while viewing someone would otherwise be unable to get out — resolveSession
 * Affiliate already stops honouring the state, but the row would sit there
 * flagged and the banner would keep showing.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const session = await requireUser(event);

	if (!session.impersonatingAffiliateId) return { stopped: false };

	await setImpersonation(session.sessionId, null);

	await audit(event, {
		actorKind: "admin",
		action: "admin.view_as_stopped",
		actorUserId: session.userId,
		subjectAffiliateId: session.impersonatingAffiliateId,
	});

	return { stopped: true };
});
