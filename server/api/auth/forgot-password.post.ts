import { email as emailCheck, object } from "../../utils/validate";

/**
 * Starts a password reset.
 *
 * Answers 204 no matter what happened — address unknown, account revoked, mail
 * provider down. The page shows "if an account exists for that address, we've
 * sent a link" and that is all anyone ever learns. Any branch that returned a
 * different status would turn this into a way to test which email addresses
 * have accounts, which is worth more to an attacker than the reset itself.
 *
 * Known and accepted: the *timing* still differs, because sending mail takes
 * longer than not sending it. Closing that would mean answering before the
 * send completes, and on a serverless host an un-awaited send is liable to be
 * killed with the response — a reset mail that never arrives is a worse
 * outcome than a slow oracle that resetIp already caps at 10 tries a quarter
 * hour. Revisit if this ever moves to a long-running host.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	// Charged before the body is parsed, for the reason spelled out in
	// login.post.ts: a malformed body must not be a free request.
	await enforceRateLimit(event, resetIpBucket(clientIp(event)), RATE_LIMITS.resetIp);

	const body = await readChecked(event, object({ email: emailCheck() }));

	await enforceRateLimit(event, resetUserBucket(body.email), RATE_LIMITS.resetUser);

	const user = await findUserByEmail(body.email);

	if (!user) {
		// Recorded so a run of requests against addresses that do not exist is
		// visible as the probe it is. The address itself is not stored.
		await audit(event, {
			actorKind: "system",
			action: "auth.reset_requested_unknown",
		});

		setResponseStatus(event, 204);
		return null;
	}

	// A revoked affiliate must not be able to let themselves back in. Admins
	// are checked separately because an admin need not have an affiliate row,
	// and locking the owner out of their own recovery would be permanent.
	const [affiliate, admin] = await Promise.all([
		db().from("affiliates").select("id, status").eq("user_id", user.id).maybeSingle(),
		db().from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle(),
	]);

	const eligible = affiliate.data?.status === "active" || Boolean(admin.data);

	if (!eligible) {
		await audit(event, {
			actorKind: "system",
			action: "auth.reset_refused_inactive",
			actorUserId: user.id,
			subjectAffiliateId: affiliate.data?.id ?? null,
		});

		setResponseStatus(event, 204);
		return null;
	}

	const token = await issueResetToken(event, user.id);

	try {
		await sendPasswordResetEmail(event, user.email, token);

		await audit(event, {
			actorKind: "system",
			action: "auth.reset_requested",
			actorUserId: user.id,
			subjectAffiliateId: affiliate.data?.id ?? null,
		});
	}
	catch (error) {
		// The response stays 204. A send failure is ours, not something the
		// caller gets to observe — but it is invisible to the affiliate, who
		// will simply never receive the mail, so it has to be loud on our side.
		console.error("[email] password reset send failed:", error);

		await audit(event, {
			actorKind: "system",
			action: "auth.reset_email_failed",
			actorUserId: user.id,
			subjectAffiliateId: affiliate.data?.id ?? null,
			meta: { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" },
		});
	}

	setResponseStatus(event, 204);
	return null;
});
