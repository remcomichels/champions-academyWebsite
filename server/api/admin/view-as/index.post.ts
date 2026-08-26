import { object, uuid } from "../../../utils/validate";

/**
 * Starts viewing an affiliate's dashboard.
 *
 * The id is validated and stored on the session here, where requireAdmin has
 * already run. From that point on the affiliate routes resolve it from the
 * session and never see it in a request — see the boundary note in auth.ts.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);
	const body = await readValidatedBody(event, object({ affiliateId: uuid() }));

	const { data: affiliate, error } = await db()
		.from("affiliates")
		.select("id, slug, display_name, status")
		.eq("id", body.affiliateId)
		.maybeSingle();

	if (error) throw createError({ statusCode: 500, statusMessage: "Could not load affiliate" });
	if (!affiliate) throw createError({ statusCode: 404, statusMessage: "Affiliate not found" });

	// Revoked accounts are viewable on purpose: working out what someone did
	// before they lost access is one of the main reasons to open this at all.
	await setImpersonation(admin.sessionId, affiliate.id as string);

	await audit(event, {
		actorKind: "admin",
		action: "admin.view_as_started",
		actorUserId: admin.userId,
		subjectAffiliateId: affiliate.id as string,
		meta: { slug: affiliate.slug as string },
	});

	return {
		slug: affiliate.slug as string,
		displayName: affiliate.display_name as string,
		status: affiliate.status as string,
	};
});
