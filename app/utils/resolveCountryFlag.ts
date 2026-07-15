// ─────────────────────────────────────────────────────────────────────────────
// resolveCountryFlag
//
// Maps a Storyblok country option value to its flag SVG in
// public/images/flags/. Auto-imported by Nuxt (app/utils/).
//
// To add a country: drop `<value>.svg` into public/images/flags/ and add one
// entry below — the key must match the option value in Storyblok exactly.
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
	canada: "/images/flags/canada.svg",
	usa: "/images/flags/usa.svg",
	netherlands: "/images/flags/netherlands.svg",
	germany: "/images/flags/germany.svg",
};

/** Returns the flag SVG path for a country option value, or null if unknown. */
export function resolveCountryFlag(country?: string): string | null {
	if (!country) return null;
	return COUNTRY_FLAGS[country.toLowerCase().trim()] ?? null;
}
