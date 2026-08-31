/**
 * Types shared by the Nuxt app and the Nitro server.
 *
 * Nuxt 4 auto-imports everything under `shared/` on both sides, so this is the
 * one place a link role or a referral shape is defined. Import explicitly as
 * `#shared/types/affiliate` where a type-only import reads clearer.
 */

/**
 * The two swappable link roles.
 *
 * There was a third, `vip`, which pointed at a Whop checkout and was the only
 * one that could produce a sale. Whop is gone and the tier is sold through
 * Telegram now, so nothing here is a purchase — `lite` is a Telegram invite and
 * `calendly` is a booking page. Both are affiliate-supplied.
 */
export type LinkRole = "lite" | "calendly";

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
