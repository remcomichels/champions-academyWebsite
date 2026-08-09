import posthog from "posthog-js";

/**
 * Visitor analytics on the public marketing site.
 *
 * Nothing is loaded until consent allows it. In the EEA, UK and Switzerland
 * that means an explicit Accept; elsewhere analytics runs by default with an
 * opt-out available. See useConsent().
 *
 * Every event carries `affiliate_slug` when the visitor arrived through a
 * referral link, which is what makes per-affiliate analytics possible. The
 * slug comes from useReferral() — resolved server-side from the httpOnly
 * cookie — so it is never read from a query string here and cannot be spoofed
 * by editing the URL.
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
	const { state, resolve, granted } = useConsent();

	let started = false;

	function start() {
		if (started) return;
		started = true;

		posthog.init(key, {
			api_host: host,
			// Pageviews are captured manually below: Nuxt is a single-page app
			// after hydration, so automatic capture records the first URL and
			// then nothing.
			capture_pageview: false,
			capture_pageleave: true,
			// The dashboard is behind a login and shows an affiliate's own
			// figures. Recording it would put one affiliate's numbers into a
			// session replay, so it is excluded outright rather than masked.
			autocapture: { css_selector_allowlist: [] },
			persistence: "localStorage+cookie",
		});

		applyReferral();
		capturePageview(router.currentRoute.value.path);
	}

	/** Attaches the referring affiliate to every subsequent event. */
	function applyReferral() {
		const slug = referral.value?.slug;
		if (slug) posthog.register({ affiliate_slug: slug });
		else posthog.unregister("affiliate_slug");
	}

	// Never track the authenticated area. Beyond the privacy problem, an
	// affiliate visiting their own dashboard would inflate their own numbers.
	const isPrivate = (path: string) => /^\/(?:[a-z]{2}\/)?(?:login|dashboard)\b/.test(path);

	function capturePageview(path: string) {
		if (!started || isPrivate(path)) return;
		applyReferral();
		posthog.capture("$pageview", { $current_url: window.location.href });
	}

	// Resolve consent once on load, then start if allowed.
	void resolve().then(() => {
		if (granted.value) start();
	});

	// The banner resolves later for visitors who had to be asked.
	watch(state, (value) => {
		if (value === "granted") start();
	});

	nuxtApp.hook("page:finish", () => {
		capturePageview(router.currentRoute.value.path);
	});

	return {
		provide: { posthog },
	};
});
