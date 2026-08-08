import { email as emailCheck, object, password as passwordCheck } from "../../utils/validate";

/**
 * Email + password sign-in.
 *
 * Supabase verifies the credentials; we mint our own opaque session. See
 * server/utils/session.ts for why the browser never receives a JWT.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const body = await readValidatedBody(event, object({
		email: emailCheck(),
		password: passwordCheck(),
	}));

	const ip = clientIp(event);
	const ipBucket = loginIpBucket(ip);
	const userBucket = loginUserBucket(body.email);

	// Both buckets are checked before any credential work: the throttle has to
	// sit in front of the password verification, not behind it.
	await enforceRateLimit(event, ipBucket, RATE_LIMITS.loginIp);
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
