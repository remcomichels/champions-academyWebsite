import Whop from "@whop/sdk";

/**
 * Whop webhook receiver.
 *
 * Currently a verified no-op: it authenticates the sender and acknowledges.
 * Attribution — reading `metadata.affiliate_user_id` and upserting into
 * `conversions` — lands in S5, once the real payload shape is confirmed.
 *
 * This is the only unauthenticated write endpoint in the system, so:
 *  - the raw body is read before any parsing, because the signature covers the
 *    exact bytes sent, not a re-serialised object;
 *  - `unwrap()` verifies that signature and throws if it does not match;
 *  - payloads are never logged by default. They carry buyer email and real
 *    name, and Whop retries, so one bad deploy would rain PII into the logs.
 */

const whopsdk = new Whop({
	apiKey: process.env.WHOP_API_KEY,
	webhookKey: btoa(process.env.WHOP_WEBHOOK_SECRET || ""),
});

/**
 * TEMPORARY, SANDBOX ONLY. Set WHOP_WEBHOOK_DEBUG=1 to dump the full payload
 * so the mapper can be written against real field names instead of guesses.
 *
 * Off unless explicitly enabled, and additionally refused when the site URL is
 * a real domain — so setting the flag in production by accident still logs
 * nothing. Remove this block once the conversions mapper exists.
 */
const debugPayloads
	= process.env.WHOP_WEBHOOK_DEBUG === "1"
		&& !/^https:\/\/(?!localhost)/.test(process.env.NUXT_PUBLIC_SITE_URL ?? "");

export default defineEventHandler(async (event) => {
	const requestBodyText = (await readRawBody(event)) ?? "";
	const rawHeaders = getHeaders(event);

	const headers: Record<string, string> = Object.fromEntries(
		Object.entries(rawHeaders).filter(
			(entry): entry is [string, string] => entry[1] !== undefined,
		),
	);

	let webhookData: ReturnType<typeof whopsdk.webhooks.unwrap>;
	try {
		webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });
	}
	catch (error) {
		// Bad or missing signature. Nothing about the payload is trustworthy,
		// so it is not logged either.
		console.warn("[whop] rejected a webhook with an invalid signature");
		if (debugPayloads) console.warn("[whop][debug] reason:", (error as Error)?.message);
		throw createError({ statusCode: 401, statusMessage: "Invalid webhook signature" });
	}

	console.info(`[whop] ${webhookData.type} received`);

	if (debugPayloads) {
		console.info("[whop][debug] full payload:\n" + JSON.stringify(webhookData, null, 2));
	}

	if (webhookData.type === "payment.succeeded") {
		// `data` is the Payment object; the same shape the REST API returns.
		const payment = webhookData.data as WhopPaymentLike;
		const outcome = await ingestPayment(payment);

		if (outcome.ok) {
			console.info(
				`[whop] ${outcome.paymentId} -> affiliate ${outcome.affiliateId}`
				+ (outcome.alreadySeen ? " (already recorded)" : " (new conversion)"),
			);
		}
		else {
			// Not an error: most sales are not affiliate sales. Recorded so an
			// attribution that *should* have worked is visible rather than silent.
			console.info(`[whop] not attributed — ${outcome.reason}`);
		}

		// Written to the audit log as well as the console so delivery can be
		// confirmed from the database. Reading a server log is not something
		// anyone should have to do to answer "did the webhook arrive?", and on
		// a serverless host the logs are somewhere else entirely.
		await audit(event, {
			actorKind: "system",
			action: outcome.ok ? "webhook.attributed" : "webhook.not_attributed",
			subjectAffiliateId: outcome.ok ? outcome.affiliateId : null,
			meta: {
				paymentId: payment.id ?? null,
				status: payment.status ?? null,
				...(outcome.ok
					? { alreadySeen: outcome.alreadySeen }
					: { reason: outcome.reason }),
			},
		});
	}
	else {
		await audit(event, {
			actorKind: "system",
			action: "webhook.ignored",
			meta: { type: webhookData.type },
		});
	}

	// Always acknowledge a properly signed webhook, including event types we do
	// not handle. A non-2xx makes Whop retry the same payload indefinitely.
	setResponseStatus(event, 200);
	return "OK";
});
