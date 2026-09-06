import type { LinkRole } from "#shared/types/affiliate";

/**
 * Host allow-list per link role.
 *
 * This link is typed in by affiliates and then reached through a redirect the
 * server issues on the public marketing site. Without this, a typo or a
 * compromised session turns every Join button into whatever was pasted.
 *
 * Kept in `shared/` so the same function runs at write time in the API and
 * again at render time in the component — one list, no drift.
 */
const ALLOWED_HOSTS: Record<LinkRole, readonly string[]> = {
	lite: ["t.me", "telegram.me"],
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

	// A role this file does not know is not an allowed one.
	//
	// `role` is typed, but one of its callers reads it off a Storyblok blok,
	// where the field is free text an editor fills in — and `calendly` was a
	// valid value until recently. An unknown key used to be impossible; now it
	// is a stale CMS entry away, and indexing straight into the table would
	// throw on `undefined.includes` rather than simply refusing the link.
	const hosts = ALLOWED_HOSTS[role];
	if (!hosts) return false;

	return hosts.includes(url.hostname.toLowerCase());
}

/** The permitted hosts for a role, for error messages the affiliate can act on. */
export function allowedHostsFor(role: LinkRole): readonly string[] {
	return ALLOWED_HOSTS[role] ?? [];
}
