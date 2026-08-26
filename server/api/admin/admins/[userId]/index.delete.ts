import { uuid } from "../../../../utils/validate";

/**
 * Removes someone's admin access.
 *
 * Refuses to remove your own. That is not politeness — admin access is only
 * grantable by an admin, so the last one to demote themselves locks everybody
 * out of the panel and the only way back is a SQL client. It also means the
 * list can never reach zero: everyone else is removable, and whoever is doing
 * the removing is not.
 *
 * Their affiliate account, if they have one, is untouched. Losing the panel is
 * not the same as losing your own dashboard.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);
	const userId = uuid()(getRouterParam(event, "userId"), "userId");

	if (userId === admin.userId) {
		throw createError({
			statusCode: 400,
			statusMessage: "You can't remove your own admin access — ask another admin, or change it in the database",
		});
	}

	const { data, error } = await db()
		.from("admin_users")
		.delete()
		.eq("user_id", userId)
		.select("user_id");

	if (error) throw createError({ statusCode: 500, statusMessage: "Could not remove admin access" });
	if (!data?.length) throw createError({ statusCode: 404, statusMessage: "They are not an admin" });

	// Admin status is read per request from this table, so it is already gone.
	// Their sessions stay: they may still be an affiliate, and this removes a
	// privilege rather than an account.
	await audit(event, {
		actorKind: "admin",
		action: "admin.revoked",
		actorUserId: admin.userId,
		meta: { userId },
	});

	return { removed: true };
});
