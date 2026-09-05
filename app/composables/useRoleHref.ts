import type { LinkRole, LinkRoleField } from "#shared/types/affiliate";

/**
 * Resolves the href for a CTA that carries a `link_role`.
 *
 * Managed links no longer render their destination into the page. They point
 * at `/go/<role>`, and the server decides where that goes: the referring
 * affiliate's link, or — for a visitor who arrived without a referral — one of
 * the owners in the house rotation, assigned on the click and remembered for
 * 30 days. See server/routes/go/[role].get.ts.
 *
 * Two things follow from moving resolution to the redirect. The rendered HTML
 * no longer varies by referral, so nothing here can leak one affiliate's link
 * into another's cached page. And the click is counted by a redirect the
 * browser must follow rather than by a beacon an ad blocker can drop.
 *
 * What is still decided here is whether the button appears at all. A managed
 * CTA with no reachable destination renders nothing, exactly as before — a
 * button leading to a 404 is worse than no button, and silence on a money
 * feature is the failure mode that goes unnoticed for weeks. The check mirrors
 * what the redirect will do: the affiliate's link if it is usable, otherwise
 * the config-story default.
 *
 * The blok's own Storyblok link field is **not** consulted for a managed link.
 * Most CTAs still carry placeholder links from before this feature existed, and
 * falling back to those would send people to the wrong place while looking like
 * it worked.
 *
 * Links with no `link_role` are untouched and keep their CMS href.
 */
export function useRoleHref() {
	const referral = useReferral();
	const { config } = useConfig();

	return (role: LinkRoleField | undefined, cmsHref: string | null): string | null => {
		// Not a managed link — behave exactly as before.
		if (!role) return cmsHref;

		const key = role as LinkRole;

		// Validated on the way out as well as on the way in. The affiliate's
		// Telegram and Calendly URLs are typed in by the affiliate, so bad data
		// that somehow reached the database still cannot make a button appear
		// that points nowhere useful.
		const affiliateHref = referral.value?.[key] ?? null;

		const defaults: Record<LinkRole, string | null> = {
			lite: resolveStoryblokLink(config.value?.default_lite),
			calendly: resolveStoryblokLink(config.value?.default_calendly),
		};

		const reachable = isAllowedLink(key, affiliateHref) || isAllowedLink(key, defaults[key]);

		// A visitor with no referral cookie gets the house rotation, which this
		// composable cannot see — it is resolved server-side on the click. The
		// default standing in for it here is the right test anyway: an owner in
		// the rotation who has not filled in their link falls through to that
		// same default at the redirect.
		if (reachable) return `/go/${key}`;

		if (import.meta.dev) {
			console.warn(
				`[useRoleHref] no usable link for role "${key}". `
				+ `Check default_${key === "calendly" ? "calendly" : key} on the Storyblok config story `
				+ `— it must be an https URL on ${allowedHostsFor(key).join(" or ")}.`,
			);
		}

		return null;
	};
}
