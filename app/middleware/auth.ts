/**
 * Requires a signed-in user.
 *
 * This is a redirect for the user's benefit, not the access control — every
 * /api/* route checks the session itself. Route middleware runs in the
 * browser on client-side navigation and can trivially be skipped.
 */
export default defineNuxtRouteMiddleware(async (to) => {
	const { fetchMe } = useAuth();
	const me = await fetchMe();

	if (!me.user) {
		// Remember where they were headed so login can send them back.
		return navigateTo({ path: "/login", query: { next: to.fullPath } });
	}
});
