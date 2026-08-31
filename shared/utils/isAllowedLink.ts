import type { LinkRole } from "#shared/types/affiliate";

/**
 * Host allow-list per link role.
 *
 * Both of these links are typed in by affiliates and then rendered as an
 * `href` on the public marketing site. Without this, a typo or a compromised
 * session turns every "Book a call" button into whatever was pasted.
 *
 * Kept in `shared/` so the same function runs at write time in the API and
 * again at render time in the component — one list, no drift.
 */
const ALLOWED_HOSTS: Record<LinkRole, readonly string[]> = {
	lite: ["t.me", "telegram.me"],
	calendly: ["calendly.com", "www.calendly.com"],
};

/**
 * True when `href` is an https URL on a host permitted for this role.
 *
 * Deliberately strict: exact host match, no subdomain wildcard. `t.me.evil.com`
 * and `evil.com/t.me` both fail, which is the whole point.
 */
export function isAllowedLink(role: LinkRole, href: string | null | undefined): boolean {
	if (!href) return false;

	let url: URL;
	try {
		url = new URL(href);
	}
	catch {
		return false;
	}

	if (url.protocol !== "https:") return false;

	return ALLOWED_HOSTS[role].includes(url.hostname.toLowerCase());
}

/** The permitted hosts for a role, for error messages the affiliate can act on. */
export function allowedHostsFor(role: LinkRole): readonly string[] {
	return ALLOWED_HOSTS[role];
}
