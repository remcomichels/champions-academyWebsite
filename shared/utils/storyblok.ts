/**
 * Which Storyblok content types are routable pages.
 *
 * A published story is not automatically a URL. The /benefits/* stories are
 * `benefit` items that exist to be resolved into the benefits block as
 * relations — there is no `benefit` component to render one with, so on its
 * own URL it produced a 200 with nothing in it but the header and footer.
 *
 * The router and the sitemap both ask this, off the same list, so the two can
 * never drift into disagreeing about what counts as a page.
 */
const PAGE_CONTENT_TYPES = new Set(["page"]);

export function isPageStory(component: string | undefined): boolean {
	return component !== undefined && PAGE_CONTENT_TYPES.has(component);
}
