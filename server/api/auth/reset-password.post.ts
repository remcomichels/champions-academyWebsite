import { assertMatches, object, password as passwordCheck, str } from "../../utils/validate";

/**
 * Completes a password reset.
 *
 * Unlike /api/affiliate/password.post.ts this cannot ask for the current
 * password — not knowing it is the whole reason someone is here. The link is
 * the only credential, which is why it is single use, dies in an hour, and is
 * stored only as a peppered HMAC.
 *
 * The token is not audited, logged or echoed back. It is a live credential for
 * as long as it exists.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	// Shares resetIp with the request endpoint on purpose: guessing tokens and
	// harvesting addresses are the same attacker doing the same thing, and one
	// budget across both is the tighter cap.
	await enforceRateLimit(event, resetIpBucket(clientIp(event)), RATE_LIMITS.resetIp);

	const body = await readValidatedBody(event, object({
		// 32 bytes base64url is 43 characters. Bounded loosely rather than
		// pinned, so a future change of token length is not a silent 400.
		token: str({ min: 20, max: 200 }),
		password: passwordCheck(),
		passwordConfirm: passwordCheck(),
	}));

	assertMatches(body.password, body.passwordConfirm, "passwordConfirm");

	// Claims the token — an atomic conditional update, so a link cannot be
	// redeemed twice however two requests interleave. From here on it is spent
	// whether or not the rest of this handler succeeds.
	const userId = await consumeResetToken(body.token);

	if (!userId) {
		await audit(event, {
			actorKind: "system",
			action: "auth.reset_token_rejected",
		});

		// One message for unknown, expired and already-used. Which of the three
		// it was is not the caller's business.
		throw createError({
			statusCode: 400,
			statusMessage: "This reset link has expired or has already been used. Request a new one.",
		});
	}

	const { data: account } = await db().auth.admin.getUserById(userId);
	const address = account?.user?.email ?? null;

	const { error } = await db().auth.admin.updateUserById(userId, { password: body.password });

	if (error) {
		// The token is already spent, so the affiliate has to start again. That
		// is the right way round: a token that survived a failed write could be
		// replayed.
		await audit(event, {
			actorKind: "system",
			action: "auth.reset_failed",
			actorUserId: userId,
			meta: { error: error.message.slice(0, 200) },
		});

		throw createError({ statusCode: 500, statusMessage: "Could not set that password" });
	}

	// Every session, not every *other* session — there is no current session
	// here, and someone resetting a password is someone who thinks an account
	// is compromised. Leaving an intruder signed in would defeat the exercise.
	await destroyAllSessions(userId);

	// Clear the per-address bucket so a run of failed attempts before a
	// successful reset doesn't leave them throttled, matching login.post.ts.
	if (address) await resetRateLimit(resetUserBucket(address));

	await audit(event, {
		actorKind: "affiliate",
		action: "auth.reset_completed",
		actorUserId: userId,
	});

	// The one email that asks the reader to do something. Best effort: the
	// password is already changed, and failing the request now would tell them
	// it had not worked when it had.
	if (address) {
		try {
			await sendPasswordChangedEmail(event, address);
		}
		catch (error) {
			console.error("[email] password changed notice failed:", error);

			await audit(event, {
				actorKind: "system",
				action: "auth.reset_notice_failed",
				actorUserId: userId,
				meta: { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" },
			});
		}
	}

	setResponseStatus(event, 204);
	return null;
});
