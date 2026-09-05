import StoryblokClient from "storyblok-js-client";
import type { LinkRole } from "#shared/types/affiliate";

/**
 * The config story's default links, read server-side.
 *
 * `useRoleHref` used to resolve these in the browser from the config story the
 * page had already fetched. Now that a managed CTA points at /go/<role>, the
 * redirect has to know them too — it is the last fallback when a visitor has no
 * referral and the house rotation is empty or the chosen owner has not filled
 * that link in.
 *
 * Cached for five minutes, matching resolveAffiliateLinks. Changing a default
 * in Storyblok therefore takes up to five minutes to take effect on the
 * redirect while taking effect immediately in the rendered page — worth knowing
 * if the two ever look like they disagree.
 */
async function lookup(): Promise<Record<LinkRole, string | null>> {
	const config = useRuntimeConfig();

	const client = new StoryblokClient({
		accessToken: config.public.storyblokApiKey as string,
		region: "eu",
	});

	try {
		const { data } = await client.get("cdn/stories/config", { version: "published" });
		const content = data?.story?.content ?? {};

		// A multilink field: `url` for an external URL, `cached_url` for
		// everything else. Both defaults here are external by nature — Telegram
		// and Calendly — but reading both costs nothing and avoids a silent null
		// if one is ever set through the story picker.
		const read = (field: { url?: string; cached_url?: string } | undefined): string | null =>
			field?.url || field?.cached_url || null;

		const lite = read(content.default_lite);
		const calendly = read(content.default_calendly);

		// Validated here as well as at render time. These come from the CMS,
		// where anyone with editor access can put an arbitrary URL in the field,
		// and this one feeds a redirect the server issues itself.
		return {
			lite: isAllowedLink("lite", lite) ? lite : null,
			calendly: isAllowedLink("calendly", calendly) ? calendly : null,
		};
	}
	catch {
		// A CMS outage must not turn every Join button into an error page. The
		// caller treats null as "no destination" and answers 404, which is the
		// same thing the button did before this route existed: nothing.
		return { lite: null, calendly: null };
	}
}

export const resolveDefaultLinks = defineCachedFunction(lookup, {
	name: "defaultLinks",
	maxAge: 300,
	swr: true,
	getKey: () => "config",
});
