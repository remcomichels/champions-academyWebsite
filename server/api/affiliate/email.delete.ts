/**
 * Drops a pending email change.
 *
 * The Cancel beside the "waiting for confirmation" line on the settings page.
 * Deleting the row is what kills the link — `consumeEmailChangeToken` matches
 * on a row that has to exist — so this is a real revocation, not just hiding
 * the notice.
 *
 * Deliberately not a way to reject a change somebody *else* started: it is
 * scoped to the signed-in user's own row, and the address being left behind
 * only hears about the change once it has gone through. Someone who finds a
 * confirmation link in their inbox and did not ask for it does not need this —
 * ignoring it is enough, because nothing has moved yet.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);
	const session = await requireUser(event);

	// Same reasoning as the POST: from inside view-as there is no right answer
	// to whose pending change this is.
	if (session.impersonatingAffiliateId) {
		throw createError({
			statusCode: 403,
			statusMessage: "Leave view-as before changing an email address",
		});
	}

	await cancelEmailChange(session.userId);

	await audit(event, {
		actorKind: "affiliate",
		action: "email.change_cancelled",
		actorUserId: session.userId,
		subjectAffiliateId: affiliate.id,
	});

	setResponseStatus(event, 204);
	return null;
});
