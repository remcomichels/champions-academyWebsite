import { object, oneOf, uuid } from "../../../../utils/validate";

/**
 * Changes an affiliate's status.
 *
 * Anything other than `active` also destroys their sessions. That is the whole
 * point of opaque server-side sessions: revocation takes effect on the very
 * next request rather than whenever a token happens to expire.
 *
 * Their link stops swapping within five minutes — resolveAffiliateLinks is
 * cached that long. Their conversions and visit history are untouched, because
 * losing access is not the same as never having sold anything.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);
	const affiliateId = uuid()(getRouterParam(event, "id"), "id");

	const body = await readValidatedBody(event, object({
		status: oneOf("active", "paused", "revoked"),
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

	await audit(event, {
		actorKind: "admin",
		action: "affiliate.status_changed",
		actorUserId: admin.userId,
		subjectAffiliateId: affiliateId,
		meta: { status: body.status, slug: data.slug as string },
	});

	return { id: affiliateId, status: data.status as string };
});
