import { assertMatches, object, password as passwordCheck } from "../../utils/validate";

/**
 * Changes the affiliate's password.
 *
 * The current password is required even though they are already signed in:
 * without it, a borrowed unlocked laptop is a permanent account takeover.
 *
 * On success every *other* session is destroyed. Changing a password is what
 * someone does when they think an account is compromised, so it has to mean
 * "and boot whoever else is in there" — otherwise it achieves nothing.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);
	const session = await requireUser(event);

	const body = await readValidatedBody(event, object({
		currentPassword: passwordCheck(),
		newPassword: passwordCheck(),
		newPasswordConfirm: passwordCheck(),
	}));

	assertMatches(body.newPassword, body.newPasswordConfirm, "newPasswordConfirm");

	if (body.newPassword === body.currentPassword) {
		throw createError({
			statusCode: 400,
			statusMessage: "That's the password you already have",
			data: { field: "newPassword", message: "Choose a different password" },
		});
	}

	const { data: user } = await db().auth.admin.getUserById(session.userId);
	const email = user.user?.email;

	if (!email) throw createError({ statusCode: 500, statusMessage: "Account has no email address" });

	// Throttled on the account, so this cannot be used to guess the current
	// password from an already-open session.
	const bucket = loginUserBucket(email);
	await enforceRateLimit(event, bucket, RATE_LIMITS.loginUser);

	const verified = await verifyPassword(email, body.currentPassword);

	if (!verified) {
		await audit(event, {
			actorKind: "affiliate",
			action: "password.change_failed",
			actorUserId: session.userId,
			subjectAffiliateId: affiliate.id,
		});
		throw createError({
			statusCode: 400,
			statusMessage: "That's not your current password",
			data: { field: "currentPassword", message: "Incorrect" },
		});
	}

	await resetRateLimit(bucket);

	const { error } = await db().auth.admin.updateUserById(session.userId, {
		password: body.newPassword,
	});

	if (error) {
		throw createError({ statusCode: 400, statusMessage: "Could not change the password" });
	}

	// Everything except the session doing the changing.
	const { error: sessionError } = await db()
		.from("sessions")
		.delete()
		.eq("user_id", session.userId)
		.neq("id", session.sessionId);

	if (sessionError) {
		// The password did change, so this is not a failure to report as one —
		// but it must be visible, because "signed out everywhere" quietly not
		// happening is the part that matters.
		console.error("[password] could not clear other sessions:", sessionError.message);
	}

	await audit(event, {
		actorKind: "affiliate",
		action: "password.changed",
		actorUserId: session.userId,
		subjectAffiliateId: affiliate.id,
	});

	return { changed: true };
});
