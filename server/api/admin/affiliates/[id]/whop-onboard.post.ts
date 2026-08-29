import { uuid } from "../../../../utils/validate";
import { allowedHostsFor } from "#shared/utils/isAllowedLink";

/**
 * Creates the affiliate's Whop checkout configuration and stores their VIP link.
 *
 * Idempotent: an affiliate that already has a configuration is left alone
 * unless `force` is passed. Re-running should be safe, because the usual reason
 * to re-run is that something failed halfway.
 *
 * Sandbox returns a purchase_url on sandbox.whop.com, which the host allow-list
 * and the database CHECK constraint both reject. The configuration id is stored
 * so webhooks can still be exercised, but the URL is not — the allow-list is
 * not widened for the convenience of testing, because a sandbox link behind a
 * live buy button is exactly the kind of hole that survives to launch.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);
	const affiliateId = uuid()(getRouterParam(event, "id"), "id");

	// An empty body is normal — force is the exception, not the rule.
	const body = await readBody<{ force?: boolean }>(event)
		.catch((): { force?: boolean } => ({}));
	const force = body?.force === true;

	const { data: affiliate, error } = await db()
		.from("affiliates")
		.select("id, slug, display_name, status, whop_checkout_configuration_id, vip_checkout_url")
		.eq("id", affiliateId)
		.maybeSingle();

	if (error) throw createError({ statusCode: 500, statusMessage: "Could not load affiliate" });
	if (!affiliate) throw createError({ statusCode: 404, statusMessage: "Affiliate not found" });

	if (affiliate.status !== "active") {
		throw createError({ statusCode: 409, statusMessage: "Affiliate is not active" });
	}

	if (affiliate.whop_checkout_configuration_id && !force) {
		return {
			alreadyOnboarded: true,
			checkoutConfigurationId: affiliate.whop_checkout_configuration_id as string,
			vipCheckoutUrl: affiliate.vip_checkout_url as string | null,
		};
	}

	let configuration: Awaited<ReturnType<typeof createCheckoutConfiguration>>;
	try {
		configuration = await createCheckoutConfiguration(affiliateId);
	}
	catch (error) {
		// Whop's own message is the useful part — "plan not found" and "bad key"
		// need completely different fixes, and a flat 502 sends you looking in
		// the wrong place.
		const detail = (error as { data?: { error?: { message?: string } }; message?: string });
		const reason = detail?.data?.error?.message ?? detail?.message ?? "unknown error";

		console.error("[whop] checkout configuration failed:", reason);

		throw createError({
			statusCode: 502,
			statusMessage: `Whop rejected the request: ${reason}`,
		});
	}

	const purchaseUrl = configuration.purchase_url ?? null;

	if (!configuration.id) {
		throw createError({ statusCode: 502, statusMessage: "Whop returned no configuration id" });
	}

	// Only a production Whop host is written to the column the site renders from.
	const isProductionHost = isAllowedLink("vip", purchaseUrl);

	const { error: saveError } = await db()
		.from("affiliates")
		.update({
			whop_checkout_configuration_id: configuration.id,
			...(isProductionHost ? { vip_checkout_url: purchaseUrl } : {}),
		})
		.eq("id", affiliateId);

	if (saveError) {
		throw createError({ statusCode: 500, statusMessage: "Could not store the checkout configuration" });
	}

	await audit(event, {
		actorKind: "admin",
		action: "affiliate.whop_onboarded",
		actorUserId: admin.userId,
		subjectAffiliateId: affiliateId,
		meta: { configurationId: configuration.id, storedUrl: isProductionHost },
	});

	return {
		alreadyOnboarded: false,
		checkoutConfigurationId: configuration.id,
		// Returned either way so it can be used manually while testing.
		purchaseUrl,
		vipCheckoutUrl: isProductionHost ? purchaseUrl : null,
		// Explains why the affiliate still sees "VIP link is being set up" when
		// onboarding against sandbox, instead of leaving it a mystery.
		urlStored: isProductionHost,
		allowedHosts: allowedHostsFor("vip"),
	};
});
