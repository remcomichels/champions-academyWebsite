export interface AffiliateSummary {
	affiliate: {
		slug: string;
		displayName: string;
		timezone: string;
		memberSince: string;
	};
	referralUrl: string;
	links: {
		vip: string | null;
		lite: string | null;
		calendly: string | null;
	};
	vipLinkPending: boolean;
	visits: {
		today: number;
		/** Comparison window for the trend shown under "Today". */
		yesterday: number;
		last30d: number;
		/** Days 31–60, so "vs last month" compares equal-length windows. */
		previous30d: number;
		total: number;
		byDay: { day: string; count: number }[];
	};
	onboarding: {
		steps: {
			liteTelegramAdded: boolean;
			calendlyAdded: boolean;
			linkShared: boolean;
			firstVisitReceived: boolean;
		};
		completed: number;
		total: number;
	};
}

/**
 * The affiliate's own figures, shared by every dashboard section.
 *
 * One `useAsyncData` key so switching tabs does not refetch, and `refresh()`
 * is available to the sections that change something (saving a link, copying
 * the referral URL) and need the onboarding strip to catch up.
 */
export function useAffiliateSummary(options: { immediate?: boolean } = {}) {
	return useAsyncData<AffiliateSummary>("affiliate-summary", () =>
		$fetch<AffiliateSummary>("/api/affiliate/summary", {
			// The session cookie is httpOnly so it has to be forwarded explicitly
			// during SSR. host and x-forwarded-* go with it because an internal
			// $fetch carries no real Host header, which otherwise leaves any
			// server-side URL building seeing `http://localhost` with no port.
			headers: import.meta.server
				? useRequestHeaders(["cookie", "host", "x-forwarded-host", "x-forwarded-proto"])
				: undefined,
		}), {
		// Skipped for accounts with no affiliate profile — an admin-only login
		// would otherwise fire a request that can only ever 403.
		immediate: options.immediate ?? true,
	});
}
