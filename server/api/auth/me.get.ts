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

	// Through the same resolver requireAffiliate uses, so the shell and the data
	// under it can never disagree about whose dashboard this is.
	//
	// The email comes along because the profile menu in the top bar prints it
	// under the name, and that menu is layout furniture on every dashboard
	// page — fetching the whole Settings payload to render one line of it would
	// be a second round trip on every navigation.
	const [admin, resolved, account] = await Promise.all([
		isAdmin(session.userId),
		resolveSessionAffiliate(session),
		db().auth.admin.getUserById(session.userId),
	]);

	const { affiliate, viewingAs } = resolved;

	// A revoked affiliate reads as signed out to the UI, so the dashboard
	// redirects instead of rendering an empty shell. Not while an admin is
	// viewing them, though — that is a legitimate thing to be looking at, and
	// signing the admin out of their own session for it would be absurd.
	if (affiliate && !viewingAs && affiliate.status !== "active") {
		return { user: null, affiliate: null };
	}

	return {
		user: { isAdmin: admin },
		affiliate: affiliate
			? {
					slug: affiliate.slug,
					displayName: affiliate.display_name,
					avatarPath: affiliate.avatar_path,
					timezone: affiliate.timezone,
					locale: affiliate.locale,
					// Held in auth, not on the affiliate row — read, never
					// written from here.
					email: account.data.user?.email ?? null,
				}
			: null,
		// Drives the banner. Null for everyone not currently viewing someone.
		viewingAs: viewingAs && affiliate
			? { slug: affiliate.slug, displayName: affiliate.display_name, status: affiliate.status }
			: null,
	};
});
