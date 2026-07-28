// ─────────────────────────────────────────────────────────────────────────────
// resolveCountryFlag
//
// Maps a Storyblok country option value to its flag SVG in
// public/images/flags/. Auto-imported by Nuxt (app/utils/).
//
// The artwork is Circle Flags by HatScripts (MIT) — square 512×512 SVGs that
// already draw the circle, so .testimonial-flag keeps a square box.
//
// To add a country: add the option in Storyblok's `country` field, drop the
// matching `<value>.svg` into public/images/flags/, and add one entry below —
// the key must match the Storyblok option value exactly (lowercase).
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
	canada: "/images/flags/canada.svg",
	usa: "/images/flags/usa.svg",
	netherlands: "/images/flags/netherlands.svg",
	germany: "/images/flags/germany.svg",
	belgium: "/images/flags/belgium.svg",
	spain: "/images/flags/spain.svg",
	france: "/images/flags/france.svg",
	england: "/images/flags/england.svg",
	portugal: "/images/flags/portugal.svg",
};

/** Returns the flag SVG path for a country option value, or null if unknown. */
export function resolveCountryFlag(country?: string): string | null {
	if (!country) return null;
	return COUNTRY_FLAGS[country.toLowerCase().trim()] ?? null;
}
