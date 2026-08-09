import Whop from "@whop/sdk";

/**
 * Whop webhook receiver.
 *
 * The only unauthenticated write endpoint in the system, so:
 *  - the raw body is read before any parsing, because the signature covers the
 *    exact bytes sent, not a re-serialised object;
 *  - `unwrap()` verifies that signature and throws if it does not match;
 *  - payloads are never logged. They carry buyer email and real name, and Whop
 *    retries, so one bad deploy would rain PII into the log store.
 *
 * Deliveries are recorded in audit_log rather than only the console. "Did the
 * webhook arrive?" should be answerable from the database — reading a server
 * log is not something anyone should need to do, and on a serverless host
 * those logs live somewhere else entirely.
 */

const whopsdk = new Whop({
	apiKey: process.env.WHOP_API_KEY,
	webhookKey: btoa(process.env.WHOP_WEBHOOK_SECRET || ""),
});

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
	catch {
		// Bad or missing signature. Nothing about the payload is trustworthy,
		// so it is not logged either.
		console.warn("[whop] rejected a webhook with an invalid signature");
		throw createError({ statusCode: 401, statusMessage: "Invalid webhook signature" });
	}

	console.info(`[whop] ${webhookData.type} received`);

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
