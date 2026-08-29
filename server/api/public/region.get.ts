/**
 * Whether this visitor needs to be asked for analytics consent.
 *
 * Called from the browser rather than resolved during SSR on purpose. If the
 * page itself varied by region the HTML would stop being cacheable, and one
 * visitor's banner state could be served to another from the CDN. This is a
 * tiny uncacheable request instead, and the page stays shared.
 *
 * Returns only a boolean and the country — nothing here identifies anyone.
 */

/**
 * EEA plus the UK and Switzerland.
 *
 * The UK is not in the EEA but has near-identical rules under UK GDPR/PECR,
 * and Switzerland's revFADP is close enough that asking is the safer default.
 */
const CONSENT_REQUIRED_COUNTRIES = new Set([
	// EU
	"AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
	"HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
	"SI", "ES", "SE",
	// EEA
	"IS", "LI", "NO",
	// UK + Switzerland
	"GB", "CH",
]);

export default defineEventHandler((event) => {
	// Never cached: the answer differs per visitor.
	setResponseHeader(event, "cache-control", "private, no-store, max-age=0");

	const country
		= getRequestHeader(event, "x-vercel-ip-country")
			?? getRequestHeader(event, "cf-ipcountry")
			?? null;

	// Unknown country means local development, a proxy that strips the header,
	// or a host that never sets one. Ask for consent in that case: over-asking
	// is a worse experience, under-asking is a compliance problem.
	const consentRequired = country === null || CONSENT_REQUIRED_COUNTRIES.has(country.toUpperCase());

	return { country, consentRequired };
});
