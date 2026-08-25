/**
 * IANA timezone names, validated against the platform's own tz database.
 *
 * The Settings field used to be checked with a regex over the *shape* of the
 * name (`Area/City`), which is wrong in both directions: it accepted `Foo/Bar`,
 * which then made Postgres raise on `at time zone`, and it turned away real
 * zones that are not spelled that way. What actually matters downstream is
 * whether ICU and Postgres recognise the name, so that is what gets asked.
 *
 * Lives in `shared/` because the picker needs the same answer in the browser
 * that the API gives on save — a field that accepts something the server then
 * refuses is the bug being fixed here.
 */

/** Longer than any real zone name; past this it is not a typo, it is a probe. */
const MAX_LENGTH = 64;

/**
 * Zones the field offers, over and above what the engine lists.
 *
 * `Intl.supportedValuesOf` is specified to return primary identifiers, and
 * engines disagree about whether plain `UTC` is one — Node 24 omits it, so
 * without this the one name everybody knows would be missing from a timezone
 * picker. Merged rather than assumed absent, since a Set drops the duplicate
 * where an engine does include it.
 */
const ALWAYS_OFFERED = ["UTC"];

/**
 * Cities the tz database still files under a name they no longer go by.
 *
 * Searching "Kolkata" found nothing, because the zone is `Asia/Calcutta` —
 * exactly the kind of near-miss this field exists to stop. Listed in both
 * directions, so whichever spelling a given engine treats as primary, typing
 * the other one still finds it. Extra *search* terms only: nothing here changes
 * what gets stored.
 */
export const TIMEZONE_ALIASES: Record<string, string> = {
	"Africa/Asmera": "Asmara",
	"Africa/Asmara": "Asmera",
	"America/Godthab": "Nuuk",
	"America/Nuuk": "Godthab",
	"Asia/Calcutta": "Kolkata",
	"Asia/Kolkata": "Calcutta",
	"Asia/Dacca": "Dhaka",
	"Asia/Dhaka": "Dacca",
	"Asia/Katmandu": "Kathmandu",
	"Asia/Kathmandu": "Katmandu",
	"Asia/Rangoon": "Yangon",
	"Asia/Yangon": "Rangoon",
	"Asia/Saigon": "Ho Chi Minh",
	"Asia/Ho_Chi_Minh": "Saigon",
	"Asia/Thimbu": "Thimphu",
	"Asia/Thimphu": "Thimbu",
	"Europe/Kiev": "Kyiv",
	"Europe/Kyiv": "Kiev",
};

let cache: string[] | null = null;

/**
 * Every timezone name this engine knows, sorted, with `UTC` guaranteed present.
 *
 * Cached: on a browser this is ~420 strings and the picker asks for it on every
 * keystroke's worth of filtering.
 */
export function timezoneNames(): string[] {
	if (cache) return cache;

	// Widely available since 2022. A browser without it still gets a working
	// field — the picker falls back to typing a name in, which is what the
	// field did before.
	const listed = typeof Intl.supportedValuesOf === "function"
		? Intl.supportedValuesOf("timeZone")
		: [];

	cache = [...new Set([...listed, ...ALWAYS_OFFERED])].sort((a, b) => a.localeCompare(b));
	return cache;
}

/**
 * Returns the spelling of a timezone name to store, or null if it isn't one.
 *
 * Canonical only as far as casing: `europe/amsterdam` comes back as
 * `Europe/Amsterdam`. Deliberately *not* `resolvedOptions().timeZone` for
 * anything the engine lists — V8 answers that with the deprecated backward
 * name, so picking `Asia/Kolkata` from the list would be saved as
 * `Asia/Calcutta` and the field would redisplay a name the affiliate never
 * chose. A genuine alias that is not in the list (`US/Pacific`) still resolves,
 * because there is no listed spelling to prefer.
 */
export function canonicalTimezone(value: string | null | undefined): string | null {
	if (!value) return null;

	const trimmed = value.trim();
	if (!trimmed || trimmed.length > MAX_LENGTH) return null;

	// Zone *names* only — no `+05:30`. Recent engines accept an offset string
	// here and hand it straight back, but Postgres reads a bare offset with the
	// POSIX sign convention, so `+05:30` means UTC−5:30 to `at time zone`. A
	// value that silently means the opposite of what it says is worse than a
	// rejected one.
	if (!/^[A-Za-z]/.test(trimmed)) return null;

	const needle = trimmed.toLowerCase();
	const listed = timezoneNames().find(zone => zone.toLowerCase() === needle);
	if (listed) return listed;

	try {
		return new Intl.DateTimeFormat("en-GB", { timeZone: trimmed }).resolvedOptions().timeZone;
	}
	catch {
		// RangeError — ICU does not know this zone.
		return null;
	}
}

/** True when the name is one the tz database recognises. */
export function isTimezone(value: string | null | undefined): boolean {
	return canonicalTimezone(value) !== null;
}
