import { object, str } from "../../utils/validate";

/**
 * Completes a change of email address.
 *
 * No session required, and that is the point: the link is mailed to the new
 * address, and the person who can read it is very often reading it on a phone
 * that has never signed in. The token is the credential — single use, dead in a
 * day, stored only as a peppered HMAC — and the row it claims already says
 * which account and which address, so there is nothing for a session to add.
 *
 * A POST rather than a GET on the link itself. Mail clients and link scanners
 * fetch URLs they are sent, and a token that is spent by being previewed is a
 * confirmation the affiliate never gets to make; the page at /confirm-email
 * posts here from script instead.
 *
 * The token is not audited, logged or echoed back. It is a live credential for
 * as long as it exists.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	await enforceRateLimit(event, emailChangeIpBucket(clientIp(event)), RATE_LIMITS.emailChangeIp);

	const body = await readValidatedBody(event, object({
		// 32 bytes base64url is 43 characters. Bounded loosely rather than
		// pinned, so a future change of token length is not a silent 400.
		token: str({ min: 20, max: 200 }),
	}));

	// Claims the token — an atomic conditional update, so a link cannot be
	// redeemed twice however two requests interleave. From here on it is spent
	// whether or not the rest of this handler succeeds.
	const claim = await consumeEmailChangeToken(body.token);

	if (!claim) {
		await audit(event, {
			actorKind: "system",
			action: "email.change_token_rejected",
		});

		// One message for unknown, expired, cancelled and already-used. Which of
		// the four it was is not the caller's business.
		throw createError({
			statusCode: 400,
			statusMessage: "This confirmation link has expired or has already been used. Ask for a new one from your account settings.",
		});
	}

	// Checked again, not just at request time. A day can pass between the two,
	// and in that time the address may have been taken — by an invite redeemed
	// with it, or by whoever else had a change pending to the same place. The
	// row is deliberately not unique on `new_email` so that racing requests are
	// settled here, at the point one of them actually claims the address.
	const taken = await findUserByEmail(claim.newEmail);

	if (taken && taken.id !== claim.userId) {
		await audit(event, {
			actorKind: "system",
			action: "email.change_conflict",
			actorUserId: claim.userId,
		});

		throw createError({
			statusCode: 409,
			statusMessage: "That address is now in use by another account. Nothing has changed — pick a different one from your account settings.",
		});
	}

	const { data: account } = await db().auth.admin.getUserById(claim.userId);
	const previous = account?.user?.email ?? null;

	// `email_confirm` marks it verified without Supabase sending a second
	// confirmation of its own. The confirming is what this link already did.
	const { error } = await db().auth.admin.updateUserById(claim.userId, {
		email: claim.newEmail,
		email_confirm: true,
	});

	if (error) {
		// The token is already spent, so the affiliate has to start again. That
		// is the right way round: a token that survived a failed write could be
		// replayed.
		await audit(event, {
			actorKind: "system",
			action: "email.change_failed",
			actorUserId: claim.userId,
			meta: { error: error.message.slice(0, 200) },
		});

		throw createError({ statusCode: 500, statusMessage: "Could not set that address" });
	}

	// Sessions are left alone, unlike a password change. Nothing about this says
	// the account is compromised, and signing someone out of the browser they
	// just confirmed from is a worse experience for no gain — the address is an
	// identifier here, not a credential.
	const { data: affiliate } = await db()
		.from("affiliates")
		.select("id")
		.eq("user_id", claim.userId)
		.maybeSingle();

	await audit(event, {
		actorKind: "affiliate",
		action: "email.changed",
		actorUserId: claim.userId,
		subjectAffiliateId: (affiliate?.id as string | undefined) ?? null,
	});

	// The notice to the address being left behind, and the reason the whole flow
	// is survivable if a session was stolen: whoever still reads the old inbox
	// finds out. Best effort — the change has already happened, and failing the
	// request now would tell the affiliate it had not worked when it had.
	if (previous) {
		try {
			await sendEmailChangedEmail(event, previous, claim.newEmail);
		}
		catch (error) {
			console.error("[email] address changed notice failed:", error);

			await audit(event, {
				actorKind: "system",
				action: "email.change_notice_failed",
				actorUserId: claim.userId,
				meta: { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" },
			});
		}
	}

	return { email: claim.newEmail };
});
