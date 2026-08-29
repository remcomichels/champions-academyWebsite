/**
 * Company-wide Whop calls. **Admin routes only.**
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Everything here is scoped to the whole company, not to one affiliate. A
 * single call can create billing objects or read across every affiliate, so
 * nothing under server/api/affiliate/ may import this file — an eslint rule
 * enforces that, because the failure mode is silent: one affiliate seeing
 * another's data looks exactly like working code.
 *
 * Affiliate-scoped reads belong in server/utils/whop.ts.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Pins the Whop API version. Matches what @whop/sdk sends by default.
 *
 * Whop dates its API versions; an unversioned request gets an older one with
 * different parameter names. Bump deliberately, never implicitly.
 */
const WHOP_API_VERSION = "2026-07-20";

interface WhopConfig {
	baseUrl: string;
	apiKey: string;
	companyId: string;
	vipPlanId: string;
}

export function whopConfig(): WhopConfig {
	const config = useRuntimeConfig();

	const apiKey = config.whopApiKey as string;
	const companyId = config.whopCompanyId as string;
	const vipPlanId = config.whopVipPlanId as string;

	if (!apiKey || !companyId) {
		throw createError({ statusCode: 500, statusMessage: "Whop is not configured" });
	}

	return {
		// Sandbox is a separate host and sandbox keys only work there. Unset in
		// production to reach the live API.
		baseUrl: (config.whopBaseUrl as string) || "https://api.whop.com/api/v1",
		apiKey,
		companyId,
		vipPlanId,
	};
}

async function whopFetch<T>(
	path: string,
	options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<T> {
	const config = whopConfig();

	// Annotated as plain `string`, not a template literal. Given a literal type
	// $fetch tries to match the URL against this app's own route table, which
	// for an external host both fails and blows the type checker's stack.
	const url: string = `${config.baseUrl}${path}`;

	const response = await $fetch(url, {
		method: options.method ?? "GET",
		headers: {
			"Authorization": `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
			"Accept": "application/json",
			// Not optional. Without it Whop serves an older API version whose
			// parameter names differ — creating a checkout configuration fails
			// with "Invalid value for parameter 'account_id'", which reads like a
			// bad company id rather than a missing header. The SDK sends this on
			// every request, which is why the same body succeeds through it.
			"Api-Version-Date": WHOP_API_VERSION,
		},
		body: options.body,
		timeout: 20000,
	});

	return response as T;
}

export interface CheckoutConfiguration {
	id: string;
	purchase_url?: string | null;
	metadata?: Record<string, unknown> | null;
}

/**
 * Creates a checkout configuration carrying the affiliate's id.
 *
 * This is the attribution mechanism: Whop copies `metadata` onto the resulting
 * payment and into the payment.succeeded webhook, which is what credits the
 * sale. Whop's own affiliate counters are not relied on — they were observed
 * not to update under conditions that should have worked.
 *
 * Note the endpoint is /checkout_configurations with an underscore. The
 * hyphenated form 404s.
 */
/**
 * Recent company payments, for reconciliation.
 *
 * Company-wide by definition, which is exactly why it lives in this file and
 * not in the affiliate-scoped client.
 */
export async function listCompanyPayments(sinceIso: string): Promise<unknown[]> {
	const config = whopConfig();

	const query = new URLSearchParams({
		company_id: config.companyId,
		first: "100",
		created_after: sinceIso,
		include_free: "true",
	});

	const response = await whopFetch<{ data?: unknown[] }>(`/payments?${query.toString()}`);
	return response.data ?? [];
}

export async function createCheckoutConfiguration(affiliateId: string): Promise<CheckoutConfiguration> {
	const config = whopConfig();

	if (!config.vipPlanId) {
		throw createError({ statusCode: 500, statusMessage: "WHOP_PLAN_ID is not set" });
	}

	return await whopFetch<CheckoutConfiguration>("/checkout_configurations", {
		method: "POST",
		body: {
			account_id: config.companyId,
			plan_id: config.vipPlanId,
			metadata: { affiliate_user_id: affiliateId },
		},
	});
}
