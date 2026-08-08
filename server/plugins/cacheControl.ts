/**
 * Marks personalised responses as uncacheable.
 *
 * `routeRules` cannot help here: they are keyed by path, and whether a
 * response is personalised depends on a cookie. This hook fires after the
 * handler and immediately before the body is written, so it is the last writer
 * and deterministically wins over the `'/**'` rule.
 *
 * `Vary: Cookie` is deliberately not used — Vercel's edge cache does not
 * honour it for personalisation, so relying on it would mean one affiliate's
 * checkout links being served to unrelated visitors.
 */
export default defineNitroPlugin((nitro) => {
	nitro.hooks.hook("beforeResponse", (event) => {
		if (!event.context.noStore) return;
		markNoStore(event);
	});
});
