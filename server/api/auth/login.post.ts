import { email as emailCheck, object, password as passwordCheck } from "../../utils/validate";

/**
 * Email + password sign-in.
 *
 * Supabase verifies the credentials; we mint our own opaque session. See
 * server/utils/session.ts for why the browser never receives a JWT.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	// The IP bucket is charged before the body is even parsed. It used to sit
	// after validation, which meant a malformed body returned 400 without
	// costing the sender anything — not a credential oracle, since you cannot
	// test a password with an invalid body, but it let one hammer the endpoint
	// for free. The per-account bucket cannot move up with it: it is keyed on
	// the email, which only exists once the body is parsed.
	const ip = clientIp(event);
	const ipBucket = loginIpBucket(ip);
	await enforceRateLimit(event, ipBucket, RATE_LIMITS.loginIp);

	const body = await readValidatedBody(event, object({
		email: emailCheck(),
		password: passwordCheck(),
	}));

	// Still in front of the password verification, which is the part that
	// matters — the throttle must never sit behind the credential check.
	const userBucket = loginUserBucket(body.email);
	await enforceRateLimit(event, userBucket, RATE_LIMITS.loginUser);

	const user = await verifyPassword(body.email, body.password);

	if (!user) {
		// One message for every failure mode. Supabase already returns an
		// identical error for unknown-email and wrong-password, so this does
		// not leak which addresses have accounts.
		await audit(event, {
			actorKind: "system",
			action: "auth.login_failed",
			meta: { reason: "invalid_credentials" },
		});
		throw createError({ statusCode: 401, statusMessage: "Invalid email or password" });
	}

	// Cleared on success so a run of typos doesn't leave someone locked out.
	await resetRateLimit(userBucket);

	await createSession(event, user.userId);

	await audit(event, {
		actorKind: "affiliate",
		action: "auth.login",
		actorUserId: user.userId,
	});

	setResponseStatus(event, 204);
	return null;
});
