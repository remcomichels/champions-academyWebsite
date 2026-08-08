/**
 * Ends the current session.
 *
 * Idempotent: signing out when already signed out is a 204, not an error, so
 * a stale tab clicking "log out" doesn't show a failure.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const session = await getAuthSession(event);

	await destroySession(event);

	if (session) {
		await audit(event, {
			actorKind: "affiliate",
			action: "auth.logout",
			actorUserId: session.userId,
		});
	}

	setResponseStatus(event, 204);
	return null;
});
