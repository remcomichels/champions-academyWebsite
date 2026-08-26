import { email as emailCheck, object } from "../../../utils/validate";

/**
 * Grants admin access to an existing account.
 *
 * By email rather than by uuid, because the uuid is not something anyone has to
 * hand. The account has to exist already — this promotes a person who can
 * already sign in, it does not create a login. Affiliates get accounts by
 * redeeming an invite; an admin who is not an affiliate has to be created in
 * Supabase first, which is the same path the first admin took.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);

	const body = await readValidatedBody(event, object({
		email: emailCheck(),
	}));

	const user = await findUserByEmail(body.email);

	if (!user) {
		// Safe to be specific: this route is admin-only, so it is not an
		// enumeration oracle — and "no account" and "already an admin" need
		// completely different next steps.
		throw createError({
			statusCode: 404,
			statusMessage: "No account with that email address. They need to sign in once before they can be made an admin.",
			data: { field: "email", message: "No account with that email" },
		});
	}

	const { error } = await db()
		.from("admin_users")
		.insert({ user_id: user.id });

	if (error) {
		if (error.code === "23505") {
			throw createError({
				statusCode: 409,
				statusMessage: "They are already an admin",
				data: { field: "email", message: "Already an admin" },
			});
		}
		throw createError({ statusCode: 500, statusMessage: "Could not grant admin access" });
	}

	await audit(event, {
		actorKind: "admin",
		action: "admin.granted",
		actorUserId: admin.userId,
		meta: { email: user.email },
	});

	return { userId: user.id, email: user.email };
});
