/**
 * Types shared by the Nuxt app and the Nitro server.
 *
 * Nuxt 4 auto-imports everything under `shared/` on both sides, so this is the
 * one place a link role or a referral shape is defined. Import explicitly as
 * `#shared/types/affiliate` where a type-only import reads clearer.
 */

/**
 * The three swappable link roles.
 *
 * Only `vip` is a Whop product and therefore the only one with purchase
 * attribution — `lite` is a Telegram invite and `calendly` is a booking page,
 * so neither can ever produce a conversion.
 */
export type LinkRole = "vip" | "lite" | "calendly";

/** What a Storyblok CTA blok carries. Empty string means "not a swappable link". */
export type LinkRoleField = LinkRole | "";

export type AffiliateStatus = "active" | "paused" | "revoked";

/**
 * The referral payload that reaches the browser.
 *
 * This is serialised into `__NUXT__` on every referred page view, so it holds
 * public link data and nothing else — no internal affiliate id, no Whop
 * affiliate id, no checkout configuration id.
 */
export interface ReferralLinks {
	slug: string;
	vip: string | null;
	lite: string | null;
	calendly: string | null;
}

/** Server-side referral context, before the private fields are stripped. */
export interface ReferralContext extends ReferralLinks {
	affiliateId: string;
}

/** The four onboarding steps shown on the dashboard Overview. */
export interface OnboardingProgress {
	liteTelegramAdded: boolean;
	calendlyAdded: boolean;
	linkShared: boolean;
	firstVisitReceived: boolean;
}
