import type { H3Event } from "h3";

/**
 * Append-only audit trail.
 *
 * NEVER pass an invite code, a password, or a session token into `meta`. The
 * signature takes a narrow record rather than an arbitrary body for that
 * reason — do not widen it to accept a request body wholesale.
 */

export type AuditActor = "admin" | "affiliate" | "system";

export interface AuditEntry {
	actorKind: AuditActor;
	action: string;
	actorUserId?: string | null;
	subjectAffiliateId?: string | null;
	meta?: Record<string, string | number | boolean | null>;
}

/**
 * Writes an audit row. Never throws.
 *
 * Audit logging is observability, not control flow — a failed insert must not
 * turn a successful login into a 500.
 */
export async function audit(event: H3Event | null, entry: AuditEntry): Promise<void> {
	try {
		await db().from("audit_log").insert({
			actor_kind: entry.actorKind,
			action: entry.action,
			actor_user_id: entry.actorUserId ?? null,
			subject_affiliate_id: entry.subjectAffiliateId ?? null,
			ip: event ? clientIp(event) : null,
			user_agent: event ? (getRequestHeader(event, "user-agent")?.slice(0, 500) ?? null) : null,
			meta: entry.meta ?? {},
		});
	}
	catch {
		// Swallowed on purpose. See above.
	}
}
