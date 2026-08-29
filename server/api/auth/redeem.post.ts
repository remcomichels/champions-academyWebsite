import { assertMatches, email as emailCheck, object, password as passwordCheck, str } from "../../utils/validate";

/**
 * Redeems a one-time invite code and creates the affiliate's account.
 *
 * This is the only path to an affiliate login — there is no public sign-up.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const ip = clientIp(event);

	// Throttled before anything touches the database, so a brute force costs an
	// attacker the same as a valid attempt and tells them nothing.
	//
	// There is no per-code bucket on purpose: a hash miss does not reveal which
	// invite was being aimed at, and a per-code counter would let anyone lock a
	// specific affiliate out of their own code. The global ceiling is what
	// bounds the search — 100/hour against 60 bits is not a threat.
	await enforceRateLimit(event, otpIpBucket(ip), RATE_LIMITS.otpIp);
	await enforceRateLimit(event, OTP_GLOBAL_BUCKET, RATE_LIMITS.otpGlobal);

	const body = await readValidatedBody(event, object({
		code: str({ max: 64 }),
		email: emailCheck(),
		emailConfirm: emailCheck(),
		password: passwordCheck(),
		passwordConfirm: passwordCheck(),
	}));

	// Typing the email wrong here locks the affiliate out of the account they
	// just created and forces the owner to reissue, so it is confirmed rather
	// than trusted.
	assertMatches(body.email, body.emailConfirm, "emailConfirm");
	assertMatches(body.password, body.passwordConfirm, "passwordConfirm");

	// One message for every failure below. Distinguishing "unknown", "expired"
	// and "already used" would turn this endpoint into an oracle; the detail
	// goes to the audit log where the owner can see it.
	const invalid = () =>
		createError({ statusCode: 400, statusMessage: "Invalid or expired code" });

	const normalized = normalizeInviteCode(body.code);
	if (!normalized) throw invalid();

	const now = new Date().toISOString();

	// Single-use is this one statement. Two concurrent redemptions of the same
	// code both run this UPDATE; exactly one matches the `redeemed_at is null`
	// predicate and gets a row back. A select-then-update would let both
	// through.
	const { data: claimed, error: claimError } = await db()
		.from("affiliate_invites")
		.update({ redeemed_at: now, redeemed_ip: ip })
		.eq("code_hash", hashInviteCode(normalized))
		.is("redeemed_at", null)
		.is("revoked_at", null)
		.gt("expires_at", now)
		.select("id, affiliate_id")
		.maybeSingle();

	if (claimError) {
		throw createError({ statusCode: 500, statusMessage: "Could not redeem code" });
	}

	if (!claimed) throw invalid();

	const inviteId = claimed.id as string;
	const affiliateId = claimed.affiliate_id as string;

	/** Puts the invite back when a later step fails, so the code is not burnt. */
	const releaseInvite = async () => {
		await db()
			.from("affiliate_invites")
			.update({ redeemed_at: null, redeemed_ip: null })
			.eq("id", inviteId);
	};

	const { data: affiliate } = await db()
		.from("affiliates")
		.select("id, slug, display_name, status, user_id")
		.eq("id", affiliateId)
		.maybeSingle();

	if (!affiliate || affiliate.status !== "active" || affiliate.user_id) {
		await releaseInvite();
		throw invalid();
	}

	const { data: created, error: createUserError } = await db().auth.admin.createUser({
		email: body.email,
		password: body.password,
		// No confirmation round-trip: possession of a code the owner handed over
		// in person is the proof, and there is no inbox to bounce off.
		email_confirm: true,
		app_metadata: { affiliate_id: affiliateId },
	});

	if (createUserError || !created?.user) {
		await releaseInvite();

		await audit(event, {
			actorKind: "system",
			action: "invite.redeem_failed",
			subjectAffiliateId: affiliateId,
			meta: { reason: createUserError?.message ?? "createUser failed" },
		});

		// The common cause is an email already registered. Saying so is safe —
		// they are holding a valid code, so this is not an enumeration oracle.
		throw createError({
			statusCode: 409,
			statusMessage: "That email address is already in use",
		});
	}

	const userId = created.user.id;

	const { error: linkError } = await db()
		.from("affiliates")
		.update({ user_id: userId })
		.eq("id", affiliateId)
		// Guards the gap between the check above and this write: if two
		// redemptions somehow raced this far, only one can claim the affiliate.
		.is("user_id", null);

	if (linkError) {
		await db().auth.admin.deleteUser(userId);
		await releaseInvite();
		throw createError({ statusCode: 500, statusMessage: "Could not link account" });
	}

	await createSession(event, userId);

	// Cleared so the affiliate's own fumbled attempts don't leave them locked
	// out of the account they just made.
	await resetRateLimit(otpIpBucket(ip));

	await audit(event, {
		actorKind: "affiliate",
		action: "invite.redeemed",
		actorUserId: userId,
		subjectAffiliateId: affiliateId,
		// No code, no password, no session token.
		meta: {},
	});

	// Best effort, and deliberately last. The account exists, the invite is
	// spent and the session cookie is already set — failing the request now
	// because a mail provider is down would tell someone their account was not
	// created when it was, and their code cannot be redeemed twice to retry.
	// They are signed in and looking at the dashboard either way; the email is
	// a convenience, not the handover.
	try {
		await sendWelcomeEmail(event, body.email, affiliate.display_name as string, affiliate.slug as string);
	}
	catch (error) {
		console.error("[email] welcome send failed:", error);

		await audit(event, {
			actorKind: "system",
			action: "invite.welcome_email_failed",
			actorUserId: userId,
			subjectAffiliateId: affiliateId,
			meta: { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" },
		});
	}

	setResponseStatus(event, 204);
	return null;
});
