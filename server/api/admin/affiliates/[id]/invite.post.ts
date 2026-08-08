import { int, object, uuid } from "../../../../utils/validate";

/**
 * Issues a one-time invite code for an affiliate.
 *
 * This is the **only** place a code is ever returned in plaintext. It is not
 * stored, not logged, and not recoverable — reissuing is the recovery path.
 *
 * Taking the affiliate id from the route is safe here in a way it never is
 * under /api/affiliate/: requireAdmin runs first, and the id is uuid-validated
 * before it reaches a query.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const admin = await requireAdmin(event);

	const affiliateId = uuid()(getRouterParam(event, "id"), "id");

	const body = await readValidatedBody(event, object({
		// 1 / 7 / 30 days rather than a free number: an invite that lives for a
		// year is a credential nobody remembers issuing.
		expiresInDays: int({ min: 1, max: 30 }),
	}));

	const { data: affiliate, error: affiliateError } = await db()
		.from("affiliates")
		.select("id, slug, display_name, status, user_id")
		.eq("id", affiliateId)
		.maybeSingle();

	if (affiliateError) {
		throw createError({ statusCode: 500, statusMessage: "Could not load affiliate" });
	}

	if (!affiliate) {
		throw createError({ statusCode: 404, statusMessage: "Affiliate not found" });
	}

	if (affiliate.status !== "active") {
		throw createError({
			statusCode: 409,
			statusMessage: "Affiliate is not active — reactivate them before issuing a code",
		});
	}

	if (affiliate.user_id) {
		// They already have a login. Issuing another invite would do nothing,
		// since redemption refuses an affiliate that is already claimed.
		throw createError({
			statusCode: 409,
			statusMessage: "Affiliate already has an account",
		});
	}

	// Revoke any outstanding invite first. The partial unique index enforces at
	// most one live code per affiliate, so this is required rather than tidy —
	// and it means a code handed out and then lost stops working the moment a
	// replacement is issued.
	await db()
		.from("affiliate_invites")
		.update({ revoked_at: new Date().toISOString() })
		.eq("affiliate_id", affiliateId)
		.is("redeemed_at", null)
		.is("revoked_at", null);

	const { code, prefix } = generateInviteCode();
	const normalized = normalizeInviteCode(code)!;
	const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000);

	const { error: insertError } = await db().from("affiliate_invites").insert({
		affiliate_id: affiliateId,
		code_hash: hashInviteCode(normalized),
		code_prefix: prefix,
		expires_at: expiresAt.toISOString(),
		created_by: admin.userId,
	});

	if (insertError) {
		throw createError({ statusCode: 500, statusMessage: "Could not create invite" });
	}

	await audit(event, {
		actorKind: "admin",
		action: "invite.issued",
		actorUserId: admin.userId,
		subjectAffiliateId: affiliateId,
		// Prefix only — never the code itself.
		meta: { prefix, expiresInDays: body.expiresInDays },
	});

	return {
		code,
		prefix,
		expiresAt: expiresAt.toISOString(),
		affiliate: { slug: affiliate.slug, displayName: affiliate.display_name },
	};
});
