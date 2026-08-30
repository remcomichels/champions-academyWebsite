/**
 * What counts as an email address here.
 *
 * Kept in `shared/` so the same test runs in the browser before a request is
 * sent and again in the API before anything is written — one rule, no drift.
 * That matters more than it looks: the dialog decides whether to show "Invalid
 * email" and the route decides whether to accept it, and two regexes drifting
 * apart means a field that passes locally and is refused by the server, with
 * the failure landing as a form-level error rather than under the input.
 *
 * The client copy is a courtesy, not a control. It saves a round trip and a
 * wasted entry in the per-account throttle; the server's copy is the one that
 * decides, and it runs whatever the browser did or did not do.
 */

/** RFC 5321's limit on a forward path. Long enough that nothing real is cut. */
export const EMAIL_MAX_LENGTH = 254;

/**
 * Deliberately loose. Real validation of an address is delivery, not a regex —
 * every attempt to be stricter than this rejects somebody's legitimate address
 * — so this only rules out what cannot be an address at all: it wants
 * something, one `@`, something, a dot, and a couple of characters after it.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trims and lower-cases before testing, matching what the API stores. */
export function isValidEmail(value: string): boolean {
	const address = value.trim().toLowerCase();
	return address.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(address);
}
