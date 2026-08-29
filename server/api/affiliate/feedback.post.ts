import { object, str } from "../../utils/validate";

/**
 * Feedback from the dashboard's top bar.
 *
 * One-way by design: this writes a row an admin reads and nothing else. There
 * is no reply, no status and no notification, which is why the dialog says so
 * before you send.
 *
 * Rate limited per affiliate rather than per IP. The endpoint needs a session
 * anyway, so the affiliate id is the honest identity here — and an IP bucket
 * would throttle a whole office to one person's enthusiasm.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);

	// Before the write and before the body is trusted for anything.
	await enforceRateLimit(event, feedbackBucket(affiliate.id), RATE_LIMITS.feedback);

	const body = await readValidatedBody(event, object({
		kind: str({ max: 8 }),
		body: str({ min: 3, max: 2000 }),
	}));

	if (body.kind !== "issue" && body.kind !== "idea") {
		throw createError({
			statusCode: 400,
			statusMessage: "Pick either an issue or an idea",
		});
	}

	const text = body.body.trim();

	if (text.length < 3) {
		throw createError({
			statusCode: 400,
			statusMessage: "Tell us a little more than that",
		});
	}

	const { error } = await db().from("feedback").insert({
		affiliate_id: affiliate.id,
		kind: body.kind,
		body: text,
	});

	if (error) {
		throw createError({
			statusCode: 503,
			statusMessage: "That didn't send. Try again in a moment",
		});
	}

	// No body. There is nothing for the client to do with the row, and
	// returning its id would invite a follow-up request that has no endpoint.
	setResponseStatus(event, 204);
	return null;
});
