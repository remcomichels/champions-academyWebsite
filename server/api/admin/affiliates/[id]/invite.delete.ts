import { uuid } from "../../../../utils/validate";

/**
 * Revokes an affiliate's outstanding invite code.
 *
 * For a code that was sent to the wrong person or shared somewhere it
 * shouldn't have been. The row is kept rather than deleted so the audit trail
 * still shows a code existed and was pulled.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);
	const affiliateId = uuid()(getRouterParam(event, "id"), "id");

	const { data, error } = await db()
		.from("affiliate_invites")
		.update({ revoked_at: new Date().toISOString() })
		.eq("affiliate_id", affiliateId)
		.is("redeemed_at", null)
		.is("revoked_at", null)
		.select("id, code_prefix");

	if (error) throw createError({ statusCode: 500, statusMessage: "Could not revoke invite" });

	if (data?.length) {
		await audit(event, {
			actorKind: "admin",
			action: "invite.revoked",
			actorUserId: admin.userId,
			subjectAffiliateId: affiliateId,
			meta: { prefix: data[0]!.code_prefix as string },
		});
	}

	return { revoked: data?.length ?? 0 };
});
