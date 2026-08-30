import { email as emailCheck, object } from "../../utils/validate";

/**
 * Starts a change of the account's email address.
 *
 * Nothing is written to auth.users here. This mints a single-use link, sends it
 * to the address being asked for, and stops — see confirm-email.post.ts for the
 * half that actually moves the account. Clicking the link is the proof, and it
 * is the only proof there is: mail sent to an address you cannot read gets you
 * nowhere.
 *
 * Unlike forgot-password this does *not* hide whether the target address is
 * already registered. That route answers every request identically because it
 * is reachable by anyone; this one requires a session on an active affiliate
 * account and is capped at five requests an hour, so the enumeration it exposes
 * is five addresses an hour to somebody who was invited by hand. Refusing
 * plainly is worth more than that: the alternative is sending a confirmation
 * link that can never work and telling the affiliate to go and wait for it.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);
	const session = await requireUser(event);

	// An admin looking at someone else's dashboard is still signed in as
	// themselves — `session.userId` is the admin's account, not the affiliate's
	// — so this would quietly change the wrong address. There is no correct
	// answer to "whose email?" from inside view-as, so it is refused.
	if (session.impersonatingAffiliateId) {
		throw createError({
			statusCode: 403,
			statusMessage: "Leave view-as before changing an email address",
		});
	}

	// Charged before the body is parsed, for the reason spelled out in
	// login.post.ts: a malformed body must not be a free request.
	await enforceRateLimit(event, emailChangeUserBucket(session.userId), RATE_LIMITS.emailChangeUser);

	const body = await readValidatedBody(event, object({ email: emailCheck() }));

	const { data: account } = await db().auth.admin.getUserById(session.userId);
	const current = account?.user?.email ?? null;

	if (!current) throw createError({ statusCode: 500, statusMessage: "Account has no email address" });

	// `emailCheck()` lower-cases, so this compares like with like.
	if (body.email === current.toLowerCase()) {
		throw createError({
			statusCode: 400,
			statusMessage: "That's the address you already use",
			data: { field: "email", message: "That's already your address" },
		});
	}

	if (await findUserByEmail(body.email)) {
		throw createError({
			statusCode: 409,
			statusMessage: "That address is already in use",
			data: { field: "email", message: "That address is already in use" },
		});
	}

	const token = await issueEmailChangeToken(event, session.userId, body.email);
	const link = `${siteOrigin(event)}/confirm-email?token=${encodeURIComponent(token)}`;

	try {
		await sendEmailChangeConfirmationEmail(event, body.email, link);
	}
	catch (error) {
		// Reported as a failure, unlike the reset flow. There is no oracle to
		// protect here — the caller already knows the address, because they just
		// typed it — and a pending change nobody can confirm is worse than an
		// error saying so. The row goes with it, or the settings page would
		// show a change waiting on a link that was never delivered.
		console.error("[email] change confirmation send failed:", error);
		await cancelEmailChange(session.userId);

		await audit(event, {
			actorKind: "system",
			action: "email.change_email_failed",
			actorUserId: session.userId,
			subjectAffiliateId: affiliate.id,
			meta: { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" },
		});

		throw createError({
			statusCode: 502,
			statusMessage: "Could not send the confirmation email. Try again in a moment.",
		});
	}

	// The address is deliberately not in `meta`. The audit trail records that a
	// change was asked for and by whom; where it was aimed is on the row in
	// email_changes, which is not append-only and can be cleaned up.
	await audit(event, {
		actorKind: "affiliate",
		action: "email.change_requested",
		actorUserId: session.userId,
		subjectAffiliateId: affiliate.id,
	});

	return { pending: body.email };
});
