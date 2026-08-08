import type { ReferralContext } from "#shared/types/affiliate";

/**
 * Request-scoped values set by `server/middleware/referral.ts` and read by the
 * cache-control plugin and `useReferral()`.
 */
declare module "h3" {
	interface H3EventContext {
		/** The affiliate referring this visitor, resolved from `?r=` or the cookie. */
		referral?: ReferralContext;
		/** Set when the response is personalised and must never be cached. */
		noStore?: boolean;
	}
}

export {};
