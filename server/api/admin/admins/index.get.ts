/**
 * Everyone with admin access.
 *
 * Membership of this list is the most privileged thing in the system, so it is
 * worth being able to see it from the panel rather than only from a SQL client
 * — an admin nobody remembers adding is exactly the thing you want to notice.
 */
export default defineEventHandler(async (event) => {
	const session = await requireAdmin(event);

	const { data, error } = await db()
		.from("admin_users")
		.select("user_id, created_at")
		.order("created_at", { ascending: true });

	if (error) throw createError({ statusCode: 500, statusMessage: "Could not load admins" });

	const rows = data ?? [];
	const ids = rows.map(row => row.user_id as string);

	// Which of them are also affiliates, so the list can name a person rather
	// than showing a bare uuid for anyone whose email does not say who they are.
	const { data: affiliates } = ids.length
		? await db().from("affiliates").select("user_id, slug, display_name").in("user_id", ids)
		: { data: [] };

	const byUser = new Map<string, { slug: string; displayName: string }>();
	for (const row of affiliates ?? []) {
		byUser.set(row.user_id as string, {
			slug: row.slug as string,
			displayName: row.display_name as string,
		});
	}

	// Email lives in auth.users, which PostgREST does not expose, so it is one
	// lookup each. The list is people with keys to the building; it is short.
	const emails = await Promise.all(
		ids.map(async (id) => {
			const { data: user } = await db().auth.admin.getUserById(id);
			return [id, user.user?.email ?? null] as const;
		}),
	);
	const emailByUser = new Map(emails);

	return {
		admins: rows.map((row) => {
			const userId = row.user_id as string;
			const affiliate = byUser.get(userId) ?? null;

			return {
				userId,
				email: emailByUser.get(userId) ?? null,
				// The one row the panel must not offer a Remove button for.
				isSelf: userId === session.userId,
				affiliateSlug: affiliate?.slug ?? null,
				displayName: affiliate?.displayName ?? null,
				createdAt: row.created_at as string,
			};
		}),
	};
});
