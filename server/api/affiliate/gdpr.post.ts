import { object, oneOf, str, whenPresent } from "../../utils/validate";

/**
 * Why somebody is leaving.
 *
 * Stored as a key rather than the sentence shown on screen, so the wording can
 * be reworded without making a year of past answers unreadable. `other` is the
 * one that carries its own explanation in `reason_note`.
 */
const DELETE_REASONS = [
	"not_using",
	"not_earning",
	"too_complicated",
	"privacy",
	"switching",
	"temporary",
	"other",
] as const;

/** Deletion sits in a grace period before anything is destroyed. */
const DELETE_GRACE_DAYS = 14;

/**
 * Account deletion requests.
 *
 * It answered `export` too — a download of everything held about an affiliate,
 * built on the spot. It came out because nobody ever asked for one: not a
 * single request was made in the lifetime of the feature, and an export route
 * that is never called is a second query over visits, clicks and the audit log
 * kept working for nothing.
 *
 * Deletion is queued rather than immediate, for two reasons: an account
 * deleted in a bad five minutes should be recoverable, and a request made
 * under pressure by someone who has taken over the account should not be
 * instant either. `cancel` withdraws a pending request.
 *
 * The queue is deliberately not drained automatically. Erasing somebody is
 * irreversible and rewrites what the programme's own figures are counted over,
 * so it stays a decision a human makes.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);
	const session = await requireUser(event);

	const body = await readValidatedBody(event, object({
		action: oneOf("delete", "cancel"),
		// Only meaningful on a delete, and optional even there — a reason is
		// worth asking for and not worth blocking somebody's exit over.
		reason: whenPresent(oneOf(...DELETE_REASONS)),
		reasonNote: whenPresent(str({ max: 500 })),
	}));

	if (body.action === "cancel") {
		const { data } = await db()
			.from("gdpr_requests")
			.update({ status: "cancelled" })
			.eq("affiliate_id", affiliate.id)
			.in("status", ["pending", "ready"])
			.select("id");

		await audit(event, {
			actorKind: "affiliate",
			action: "gdpr.cancelled",
			actorUserId: session.userId,
			subjectAffiliateId: affiliate.id,
			meta: { count: data?.length ?? 0 },
		});

		return { cancelled: data?.length ?? 0 };
	}

	const executeAfter = new Date(Date.now() + DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);

	const { error } = await db().from("gdpr_requests").insert({
		affiliate_id: affiliate.id,
		kind: "delete",
		status: "pending",
		execute_after: executeAfter.toISOString(),
		reason: body.reason ?? null,
		// Blank counts as absent. Somebody who opened the note field and typed
		// nothing has not given a note.
		reason_note: body.reasonNote?.trim() || null,
	});

	if (error) throw createError({ statusCode: 500, statusMessage: "Could not record the request" });

	await audit(event, {
		actorKind: "affiliate",
		action: "gdpr.delete_requested",
		actorUserId: session.userId,
		subjectAffiliateId: affiliate.id,
		// The key, never the note. `meta` is append-only and the note is free
		// text somebody typed about why they are leaving — it lives on the
		// request row, which the purge removes with everything else.
		meta: { executeAfter: executeAfter.toISOString(), reason: body.reason ?? "unstated" },
	});

	return {
		requested: true,
		executeAfter: executeAfter.toISOString(),
		graceDays: DELETE_GRACE_DAYS,
	};
});
