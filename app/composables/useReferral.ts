import type { ReferralContext, ReferralLinks } from "#shared/types/affiliate";

/**
 * The affiliate currently referring this visitor, if any.
 *
 * Resolved server-side by `server/middleware/referral.ts` and read straight off
 * the h3 event during SSR — no extra HTTP round-trip. `useState` carries it
 * through hydration and client-side navigation, so the swap survives soft
 * navigations without re-resolving.
 */
export function useReferral() {
	const referral = useState<ReferralLinks | null>("referral", () => null);

	if (import.meta.server && referral.value === null) {
		const context = useRequestEvent()?.context.referral as ReferralContext | undefined;

		// Only public link data crosses into the payload. The internal affiliate
		// id stays on the server — it would otherwise be readable in the page
		// source of every referred visit.
		referral.value = context
			? {
					slug: context.slug,
					lite: context.lite,
					calendly: context.calendly,
				}
			: null;
	}

	return referral;
}
