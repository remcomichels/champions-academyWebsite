import { object, oneOf, uuid } from "../../../../utils/validate";

/**
 * Changes an affiliate's status.
 *
 * Anything other than `active` also destroys their sessions. That is the whole
 * point of opaque server-side sessions: revocation takes effect on the very
 * next request rather than whenever a token happens to expire.
 *
 * Their cached links are dropped at the same time, so the swap stops on the
 * next request rather than whenever the five-minute TTL happens to lapse.
 * Their conversions and visit history are untouched, because losing access is
 * not the same as never having sold anything.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);
	const affiliateId = uuid()(getRouterParam(event, "id"), "id");

	const body = await readValidatedBody(event, object({
		status: oneOf("active", "revoked"),
	}));

	const { data, error } = await db()
		.from("affiliates")
		.update({ status: body.status })
		.eq("id", affiliateId)
		.select("id, slug, status, user_id")
		.maybeSingle();

	if (error) throw createError({ statusCode: 400, statusMessage: "Could not update status" });
	if (!data) throw createError({ statusCode: 404, statusMessage: "Affiliate not found" });

	if (body.status !== "active" && data.user_id) {
		await destroyAllSessions(data.user_id as string);
	}

	// Both directions: reactivating has the same staleness problem in reverse,
	// where the cache still holds the miss from while they were revoked.
	await invalidateAffiliateLinks(affiliateId, data.slug as string);

	await audit(event, {
		actorKind: "admin",
		action: "affiliate.status_changed",
		actorUserId: admin.userId,
		subjectAffiliateId: affiliateId,
		meta: { status: body.status, slug: data.slug as string },
	});

	return { id: affiliateId, status: data.status as string };
});
