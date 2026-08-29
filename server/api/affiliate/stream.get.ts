/**
 * Live sale notifications for the signed-in affiliate.
 *
 * Server-sent events rather than Supabase Realtime, which would require a
 * Supabase JWT in the browser and defeat the httpOnly session this whole
 * design rests on. The stream is scoped by requireAffiliate() like everything
 * else here.
 *
 * The handler polls this affiliate's own notifications on an interval instead
 * of holding a Postgres LISTEN connection: a serverless invocation cannot keep
 * one open, and one indexed read every few seconds for a connected dashboard
 * is cheaper than the machinery to avoid it.
 *
 * Hosts cap streaming duration, so the connection will be closed from under
 * us. That is fine — EventSource reconnects on its own and `Last-Event-ID`
 * resumes from the last notification seen, so nothing is missed.
 */

/** How often to look for new rows. Sale toasts do not need sub-second latency. */
const POLL_MS = 8000;

/** Closed well inside typical platform limits so the client reconnects cleanly. */
const MAX_LIFETIME_MS = 4 * 60 * 1000;

export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);

	// Never let a proxy buffer or cache a stream.
	setResponseHeader(event, "cache-control", "private, no-store, no-transform");
	setResponseHeader(event, "x-accel-buffering", "no");

	const stream = createEventStream(event);

	// Resume point. The client sends this back automatically on reconnect.
	const lastEventId = getRequestHeader(event, "last-event-id");
	let since = lastEventId && /^\d+$/.test(lastEventId) ? Number(lastEventId) : 0;

	// On a fresh connection, start from now rather than replaying history —
	// otherwise opening the dashboard fires a toast for every past sale.
	if (!since) {
		const { data } = await db()
			.from("notifications")
			.select("id")
			.eq("affiliate_id", affiliate.id)
			.order("id", { ascending: false })
			.limit(1)
			.maybeSingle();

		since = Number(data?.id ?? 0);
	}

	const poll = async () => {
		const { data, error } = await db()
			.from("notifications")
			.select("id, kind, payload, created_at")
			.eq("affiliate_id", affiliate.id)
			.gt("id", since)
			.order("id", { ascending: true })
			.limit(20);

		if (error || !data?.length) return;

		for (const row of data) {
			since = Number(row.id);
			await stream.push({
				id: String(row.id),
				event: String(row.kind),
				data: JSON.stringify({
					id: row.id,
					kind: row.kind,
					payload: row.payload,
					createdAt: row.created_at,
				}),
			});
		}
	};

	const interval = setInterval(() => { void poll(); }, POLL_MS);
	const lifetime = setTimeout(() => { void stream.close(); }, MAX_LIFETIME_MS);

	// Keepalive, and one immediately. Without an early byte a proxy can hold the
	// response open with nothing buffered through, so the client sees a
	// connection that never "opens" — and any intermediary with an idle timeout
	// drops a quiet stream.
	//
	// A named event rather than an SSE comment: h3 renders `comment` as an
	// empty `data:` frame, which fires a spurious `message` event in the
	// browser. Nothing listens for "ping", so this is inert on the client.
	const ping = async () => {
		await stream.push({ event: "ping", data: "" });
	};

	void ping();
	const keepalive = setInterval(() => { void ping(); }, 20000);

	stream.onClosed(() => {
		clearInterval(interval);
		clearInterval(keepalive);
		clearTimeout(lifetime);
	});

	return stream.send();
});
