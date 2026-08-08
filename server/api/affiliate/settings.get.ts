/**
 * Everything the Settings tab needs, in one request.
 *
 * Scoped by requireAffiliate() like every route here. The session list is the
 * affiliate's own; there is no way to ask about anyone else's.
 */

/** Slug changes are limited to one a month — see slug.post.ts for why. */
const SLUG_COOLDOWN_DAYS = 30;

export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);
	const current = await requireUser(event);

	const [sessions, audit, gdpr, user] = await Promise.all([
		db().from("sessions")
			.select("id, issued_at, last_seen_at, user_agent, ip")
			.eq("user_id", current.userId)
			.is("revoked_at", null)
			.gt("absolute_expires_at", new Date().toISOString())
			.order("last_seen_at", { ascending: false }),

		db().from("audit_log")
			.select("at, action, ip")
			.eq("subject_affiliate_id", affiliate.id)
			.order("at", { ascending: false })
			.limit(20),

		db().from("gdpr_requests")
			.select("id, kind, status, execute_after, created_at")
			.eq("affiliate_id", affiliate.id)
			.in("status", ["pending", "ready"])
			.order("created_at", { ascending: false }),

		db().auth.admin.getUserById(current.userId),
	]);

	const changedAt = affiliate.slug_changed_at ? new Date(affiliate.slug_changed_at) : null;
	const nextSlugChange = changedAt
		? new Date(changedAt.getTime() + SLUG_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
		: null;

	const prefs = (affiliate.notification_prefs ?? {}) as Record<string, unknown>;

	return {
		profile: {
			displayName: affiliate.display_name,
			slug: affiliate.slug,
			timezone: affiliate.timezone,
			locale: affiliate.locale,
			// Read from auth rather than stored twice; changing it is not
			// supported yet, so it is shown for reference only.
			email: user.data.user?.email ?? null,
			memberSince: affiliate.created_at,
		},

		slugChange: {
			// Null means never changed, so a change is allowed right now.
			nextAllowedAt: nextSlugChange && nextSlugChange > new Date()
				? nextSlugChange.toISOString()
				: null,
			cooldownDays: SLUG_COOLDOWN_DAYS,
		},

		notificationPrefs: {
			// In-app defaults on, email defaults off. Nobody should be opted into
			// email by a schema default before delivery even exists.
			saleInApp: prefs.saleInApp !== false,
			saleEmail: prefs.saleEmail === true,
		},

		sessions: (sessions.data ?? []).map(row => ({
			id: row.id as string,
			// Flagged rather than exposing the token: the client only needs to
			// know which row not to offer to kill.
			current: row.id === current.sessionId,
			issuedAt: row.issued_at as string,
			lastSeenAt: row.last_seen_at as string,
			// Trimmed to something readable — a full UA string is noise.
			device: summariseUserAgent(row.user_agent as string | null),
			ip: row.ip as string | null,
		})),

		recentActivity: (audit.data ?? []).map(row => ({
			at: row.at as string,
			action: row.action as string,
			ip: row.ip as string | null,
		})),

		gdprRequests: (gdpr.data ?? []).map(row => ({
			id: row.id as string,
			kind: row.kind as string,
			status: row.status as string,
			executeAfter: row.execute_after as string | null,
			createdAt: row.created_at as string,
		})),
	};
});

/** Best-effort browser/OS label. Not identification, just recognisability. */
function summariseUserAgent(ua: string | null): string {
	if (!ua) return "Unknown device";

	const browser
		= /Edg\//.test(ua) ? "Edge"
			: /OPR\//.test(ua) ? "Opera"
				: /Chrome\//.test(ua) ? "Chrome"
					: /Safari\//.test(ua) ? "Safari"
						: /Firefox\//.test(ua) ? "Firefox"
							: "Browser";

	const os
		= /iPhone|iPad/.test(ua) ? "iOS"
			: /Android/.test(ua) ? "Android"
				: /Mac OS X/.test(ua) ? "macOS"
					: /Windows/.test(ua) ? "Windows"
						: /Linux/.test(ua) ? "Linux"
							: "";

	return os ? `${browser} on ${os}` : browser;
}
