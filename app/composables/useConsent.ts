export type ConsentState = "unknown" | "required" | "granted" | "denied";

/** Remembers the choice for a year; re-asking every visit is its own annoyance. */
const CONSENT_COOKIE = "ca_analytics_consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Analytics consent, geo-gated.
 *
 * Visitors in the EEA, UK and Switzerland are asked before any analytics
 * cookie is set. Everywhere else analytics runs by default, with an opt-out
 * still available from the privacy policy.
 *
 * Entirely client-side: the server-rendered HTML must not vary by region or by
 * consent, or it stops being cacheable and one visitor's banner state could be
 * served to another.
 */
export function useConsent() {
	const state = useState<ConsentState>("analytics-consent", () => "unknown");

	const cookie = useCookie<string | null>(CONSENT_COOKIE, {
		maxAge: CONSENT_MAX_AGE,
		sameSite: "lax",
		secure: true,
		path: "/",
		// Read by this composable in the browser, so it cannot be httpOnly.
		// It holds a yes/no, not a credential.
	});

	/** Resolves the current state, asking the server about region only if needed. */
	async function resolve(): Promise<ConsentState> {
		if (cookie.value === "granted" || cookie.value === "denied") {
			state.value = cookie.value;
			return state.value;
		}

		try {
			const { consentRequired } = await $fetch<{ consentRequired: boolean }>("/api/public/region");

			// Outside the consent regions, analytics is on by default. The choice
			// is still recorded so the same decision holds if they travel.
			state.value = consentRequired ? "required" : "granted";
			if (!consentRequired) cookie.value = "granted";
		}
		catch {
			// If region cannot be determined, ask. Over-asking is a worse
			// experience; under-asking is a compliance problem.
			state.value = "required";
		}

		return state.value;
	}

	const accept = () => {
		cookie.value = "granted";
		state.value = "granted";
	};

	const decline = () => {
		cookie.value = "denied";
		state.value = "denied";
	};

	/**
	 * Reopens the choice.
	 *
	 * Withdrawing consent has to be as easy as giving it — telling people to go
	 * and clear cookies in their browser is not an equivalent path, and it is
	 * the usual thing regulators pick up on. Reachable from the footer on every
	 * page and from the privacy policy.
	 *
	 * Reopens for everyone, not only visitors who were asked: someone outside
	 * the EEA who wants to opt out should be able to, even though they were
	 * never prompted.
	 */
	const reopen = () => {
		cookie.value = null;
		state.value = "required";
	};

	return {
		state,
		resolve,
		accept,
		decline,
		reopen,
		/** True only once the visitor has actually allowed it. */
		granted: computed(() => state.value === "granted"),
		/** Drives the banner. */
		mustAsk: computed(() => state.value === "required"),
	};
}
