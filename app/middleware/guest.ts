/**
 * Keeps signed-in users off the login page.
 *
 * Skipped when a `next` query is present so that a redirect loop is
 * impossible: if the dashboard bounced someone here, letting them straight
 * back could bounce them straight out again.
 */
export default defineNuxtRouteMiddleware(async (to) => {
	if (to.query.next) return;

	const { fetchMe } = useAuth();
	const me = await fetchMe();

	if (me.user) return navigateTo("/dashboard");
});
