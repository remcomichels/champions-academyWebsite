import type { LinkRole } from "#shared/types/affiliate";

/**
 * Records that a referred visitor clicked one of the affiliate's links.
 *
 * `sendBeacon` rather than `fetch`: these clicks are on outbound links, so the
 * page is being torn down as the request goes out. A normal fetch is cancelled
 * on navigation; a beacon is handed to the browser to deliver regardless.
 *
 * Fire and forget in the truest sense — the visitor's navigation must never
 * wait on it, and a failure to count is not worth a single visible symptom.
 * The server ignores the call entirely when there is no referral cookie, so
 * there is no attempt to work out here whether it is worth sending.
 */
export function useLinkClick() {
	return (role: LinkRole | "" | null | undefined) => {
		if (!role || !import.meta.client) return;
		if (typeof navigator.sendBeacon !== "function") return;

		try {
			// A typed Blob rather than a bare string: sendBeacon otherwise sends
			// text/plain, which readValidatedBody will not parse as JSON.
			navigator.sendBeacon(
				"/api/public/click",
				new Blob([JSON.stringify({ role })], { type: "application/json" }),
			);
		}
		catch {
			// Counting is never allowed to break a link.
		}
	};
}
