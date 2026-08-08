/**
 * Who is signed in.
 *
 * Returns 200 with nulls rather than 401 when signed out, so route middleware
 * and the dashboard shell can call it unconditionally without treating a
 * normal logged-out state as an error.
 *
 * Only fields the browser is allowed to know are returned — no user id, no
 * Whop identifiers, no checkout configuration id.
 */
export default defineEventHandler(async (event) => {
	const session = await getAuthSession(event);

	if (!session) {
		return { user: null, affiliate: null };
	}

	const [admin, affiliateResult] = await Promise.all([
		isAdmin(session.userId),
		db()
			.from("affiliates")
			.select("slug, display_name, status, avatar_path, timezone, locale")
			.eq("user_id", session.userId)
			.maybeSingle(),
	]);

	const affiliate = affiliateResult.data;

	// A suspended or revoked affiliate reads as signed out to the UI, so the
	// dashboard redirects instead of rendering an empty shell.
	if (affiliate && affiliate.status !== "active") {
		return { user: null, affiliate: null };
	}

	return {
		user: { isAdmin: admin },
		affiliate: affiliate
			? {
					slug: affiliate.slug as string,
					displayName: affiliate.display_name as string,
					avatarPath: affiliate.avatar_path as string | null,
					timezone: affiliate.timezone as string,
					locale: affiliate.locale as string,
				}
			: null,
	};
});
