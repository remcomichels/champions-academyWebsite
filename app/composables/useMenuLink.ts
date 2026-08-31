import type { MenuLinkItem } from "~/types/storyblok";

/**
 * Href and anchor attributes for a config-story `menu_link`.
 *
 * The header CTA and the footer columns render their own `<NuxtLink>` rather
 * than going through `button.vue`, so they need the same `link_role` handling
 * applied here instead.
 */
export function useMenuLink() {
	const roleHref = useRoleHref();
	const linkPath = useStoryblokLink();
	const recordClick = useLinkClick();

	const href = (item: MenuLinkItem): string | null =>
		// Managed links are absolute external URLs, so they must not be run
		// through localePath — that would turn https://t.me/... into
		// /en/https://t.me/...
		roleHref(item.link_role, linkPath(item.link));

	const attrs = (item: MenuLinkItem): { target?: string; rel?: string } =>
		item.link_role
			? { target: "_blank", rel: "noopener noreferrer" }
			: storyblokLinkAttrs(item.link);

	/** Only managed links are counted; an ordinary CMS link is nobody's metric. */
	const onClick = (item: MenuLinkItem) => recordClick(item.link_role);

	return { href, attrs, onClick };
}
