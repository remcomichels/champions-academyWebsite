import Whop from "@whop/sdk";

/**
 * Whop webhook receiver.
 *
 * Currently a verified no-op: it authenticates the sender and acknowledges.
 * Attribution — reading `metadata.affiliate_user_id` and upserting into
 * `conversions` — lands in S5.
 *
 * This is the only unauthenticated write endpoint in the system, so:
 *  - the raw body is read before any parsing, because the signature covers
 *    the exact bytes sent, not a re-serialised object;
 *  - `unwrap()` verifies that signature and throws if it does not match;
 *  - payloads are never logged. They contain buyer email and real name, and
 *    Whop retries, so one bad deploy would rain PII into the log store.
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
		throw createError({ statusCode: 401, statusMessage: "Invalid webhook signature" });
	}

	// Log the event type only — never the payload.
	if (webhookData.type === "payment.succeeded") {
		console.info("[whop] payment.succeeded received");
	}

	// Always acknowledge a properly signed webhook, including event types we do
	// not handle. A non-2xx makes Whop retry the same payload indefinitely.
	setResponseStatus(event, 200);
	return "OK";
});
