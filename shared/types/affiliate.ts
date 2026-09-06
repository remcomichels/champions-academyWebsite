/**
 * Types shared by the Nuxt app and the Nitro server.
 *
 * Nuxt 4 auto-imports everything under `shared/` on both sides, so this is the
 * one place a link role or a referral shape is defined. Import explicitly as
 * `#shared/types/affiliate` where a type-only import reads clearer.
 */

/**
 * The swappable link role. One, now.
 *
 * There were three. `vip` pointed at a Whop checkout and was the only one that
 * could produce a sale; it went when the tier moved to Telegram. `calendly` was
 * a booking page and went with the offer that needed it. What remains is `lite`
 * — the affiliate's own Telegram invite — which is the only link the marketing
 * site swaps per referral.
 *
 * Kept as a union of one rather than collapsed to a bare string: the role is
 * still a closed set that the host allow-list, the /go route and the click
 * table all key on, and a second one is a plausible thing to want again.
 */
export type LinkRole = "lite";

/** What a Storyblok CTA blok carries. Empty string means "not a swappable link". */
export type LinkRoleField = LinkRole | "";

/**
 * Access is binary. There was a `paused` value once; nothing ever read it, so
 * a paused affiliate was revoked under a gentler name. See migration
 * 20260826000009.
 */
export type AffiliateStatus = "active" | "revoked";

/**
 * The referral payload that reaches the browser.
 *
 * This is serialised into `__NUXT__` on every referred page view, so it holds
 * public link data and nothing else — no internal affiliate id.
 */
export interface ReferralLinks {
	slug: string;
	lite: string | null;
}

/** Server-side referral context, before the private fields are stripped. */
export interface ReferralContext extends ReferralLinks {
	affiliateId: string;
}

/** The three onboarding steps shown on the dashboard Overview. */
export interface OnboardingProgress {
	liteTelegramAdded: boolean;
	linkShared: boolean;
	firstVisitReceived: boolean;
}
