import type { LinkRole, LinkRoleField } from "#shared/types/affiliate";

/**
 * Resolves the href for a CTA that carries a `link_role`.
 *
 * Resolution order, deliberately short:
 *
 *   1. the referring affiliate's own link for that role
 *   2. the config-story default for that role
 *
 * The blok's own Storyblok link field is **not** consulted for a managed
 * link. Most CTAs still carry placeholder links from before this feature
 * existed, and falling back to those would send buyers to the wrong place
 * while looking like it worked. A missing default renders no button at all,
 * which is loud — silence on a money feature is the failure mode that goes
 * unnoticed for weeks.
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
		// that somehow reached the database still cannot put an arbitrary host
		// behind a button on the marketing site.
		const affiliateHref = referral.value?.[key] ?? null;
		if (isAllowedLink(key, affiliateHref)) return affiliateHref;

		const defaults: Record<LinkRole, string | null> = {
			lite: resolveStoryblokLink(config.value?.default_lite),
			calendly: resolveStoryblokLink(config.value?.default_calendly),
		};

		const fallback = defaults[key];
		if (isAllowedLink(key, fallback)) return fallback;

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
