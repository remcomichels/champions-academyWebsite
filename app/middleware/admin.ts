/**
 * Requires an admin session.
 *
 * Sends non-admins to the site root rather than showing a 403 — whether an
 * admin area exists is not worth confirming to a signed-in affiliate poking at
 * URLs. The /api/admin/* routes answer 404 for the same reason.
 */
export default defineNuxtRouteMiddleware(async () => {
	const { fetchMe } = useAuth();
	const me = await fetchMe();

	if (!me.user) return navigateTo("/login");
	if (!me.user.isAdmin) return navigateTo("/");
});
