import type { MenuLinkItem } from "~/types/storyblok";

/**
 * Href and anchor attributes for a config-story `menu_link`.
 *
 * The header CTA and the footer columns render their own `<NuxtLink>` rather
 * than going through `button.vue`, so they need the same `link_role` handling
 * applied here instead.
 *
 * There is no click handler any more. A managed link points at /go/<role>, and
 * that redirect records the click server-side — which a sendBeacon could not do
 * reliably, since the page is being torn down as it fires and an ad blocker can
 * drop it outright.
 */
export function useMenuLink() {
	const roleHref = useRoleHref();
	const linkPath = useStoryblokLink();

	const href = (item: MenuLinkItem): string | null =>
		// Managed links are absolute external URLs, so they must not be run
		// through localePath — that would turn https://t.me/... into
		// /en/https://t.me/...
		roleHref(item.link_role, linkPath(item.link));

	const attrs = (item: MenuLinkItem): { target?: string; rel?: string } =>
		item.link_role
			? { target: "_blank", rel: "noopener noreferrer" }
			: storyblokLinkAttrs(item.link);

	return { href, attrs };
}
