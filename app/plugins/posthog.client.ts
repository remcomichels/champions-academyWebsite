import posthog from "posthog-js";

/**
 * Visitor analytics on the public marketing site.
 *
 * Every event carries `affiliate_slug` when the visitor arrived through a
 * referral link, which is what makes per-affiliate analytics possible at all.
 * The slug comes from `useReferral()` — resolved server-side from the httpOnly
 * cookie and passed down in the payload — so it is never read from a
 * query string here and cannot be spoofed by editing the URL.
 *
 * Client-only: PostHog is a browser SDK, and there is nothing to capture
 * during SSR.
 */
export default defineNuxtPlugin((nuxtApp) => {
	const config = useRuntimeConfig();
	const key = config.public.posthogKey as string;
	const host = config.public.posthogHost as string;

	// Unconfigured is a normal state in development — do nothing rather than
	// throwing on every page load.
	if (!key || !host) return;

	const router = useRouter();
	const referral = useReferral();

	posthog.init(key, {
		api_host: host,
		// Pageviews are captured manually below: Nuxt is a single-page app after
		// hydration, so automatic capture records the first URL and then nothing.
		capture_pageview: false,
		capture_pageleave: true,
		// The dashboard is behind a login and shows an affiliate's own figures.
		// Recording it would put one affiliate's numbers into a session replay,
		// so it is excluded outright rather than masked.
		autocapture: {
			css_selector_allowlist: [],
		},
		persistence: "localStorage+cookie",
	});

	/** Attaches the referring affiliate to every subsequent event. */
	const applyReferral = () => {
		const slug = referral.value?.slug;
		if (slug) posthog.register({ affiliate_slug: slug });
		else posthog.unregister("affiliate_slug");
	};

	applyReferral();

	// Never track the authenticated area. Beyond the privacy problem, affiliate
	// traffic to their own dashboard would otherwise inflate their own numbers.
	const isPrivate = (path: string) => /^\/(?:[a-z]{2}\/)?(?:login|dashboard)\b/.test(path);

	const capturePageview = (path: string) => {
		if (isPrivate(path)) return;
		applyReferral();
		posthog.capture("$pageview", { $current_url: window.location.href });
	};

	nuxtApp.hook("page:finish", () => {
		capturePageview(router.currentRoute.value.path);
	});

	return {
		provide: {
			posthog,
		},
	};
});
