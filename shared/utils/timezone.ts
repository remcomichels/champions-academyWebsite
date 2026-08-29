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

/**
 * The zone's current UTC offset, formatted as the picker shows it.
 *
 * ── Why this is computed and not looked up ──────────────────────────────────
 * A zone does not *have* an offset; it has an offset right now. Amsterdam is
 * +01:00 in January and +02:00 in July, and roughly half the world's zones do
 * something like that. Any table of offsets written down in a file is therefore
 * wrong for part of every year — which is why the shipped `timezone.md`, whose
 * entries read "(UTC-08:00) Pacific Standard Time", is not the source here.
 *
 * `Intl.DateTimeFormat` resolves against an actual instant, so passing it `now`
 * gets today's answer including whatever DST rule is in force. Pass a date in
 * six months' time and it would say something different, correctly.
 *
 * `longOffset` yields "GMT+02:00" (and bare "GMT" at zero), which is restated
 * as "UTC+02:00" / "UTC" — the wording the design asked for, and the one people
 * recognise from other dashboards.
 */
export function timezoneOffsetLabel(zone: string, now: Date = new Date()): string {
	try {
		const parts = new Intl.DateTimeFormat("en-GB", {
			timeZone: zone,
			timeZoneName: "longOffset",
		}).formatToParts(now);

		const raw = parts.find(part => part.type === "timeZoneName")?.value ?? "";

		// "GMT" alone is the zero offset; everything else is "GMT±HH:MM".
		if (raw === "GMT" || raw === "UTC" || raw === "") return "UTC";
		return raw.replace(/^(GMT|UTC)/, "UTC");
	}
	catch {
		// An unknown zone should not take the whole picker down with it.
		return "UTC";
	}
}

/**
 * The readable half of a zone name: its last segment, with the underscores the
 * tz database uses in place of spaces put back. `America/Argentina/Buenos_Aires`
 * is "Buenos Aires".
 */
export function timezoneCity(zone: string): string {
	return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

/** "(UTC+02:00) Europe/Amsterdam" — for the row that shows the current zone. */
export function timezoneLabel(zone: string, now: Date = new Date()): string {
	return `(${timezoneOffsetLabel(zone, now)}) ${zone.replace(/_/g, " ")}`;
}

export interface TimezoneGroup {
	/** The zone actually stored when this row is chosen. */
	value: string;
	/** Every zone folded into this row, for matching a stored value back. */
	zones: string[];
	/** Their readable names, sorted. */
	cities: string[];
	/** "(UTC+02:00)" — resolved against `now`, so DST-correct. */
	offsetLabel: string;
	/** Minutes from UTC right now. The sort key. */
	offset: number;
}

/**
 * The zone list, folded into rows that mean the same thing.
 *
 * Four hundred-odd IANA zones is not a list anybody reads; most of it is the
 * same handful of clocks under different city names. Zones are grouped by the
 * pair (offset in January, offset in July), which is a fingerprint of both the
 * standard offset *and* the DST rule — so Amsterdam, Berlin, Rome, Stockholm,
 * Vienna, Belgrade and Prague collapse into one row, while Lagos, which sits at
 * the same +01:00 but never moves, stays separate. That is exactly the
 * distinction that matters: two zones in one row will agree on every timestamp
 * this dashboard ever buckets. 418 zones become 57 rows.
 *
 * Derived rather than transcribed from a list. The Windows/CLDR groupings that
 * inspired this split that European row in two for historical reasons with no
 * present-day meaning, and any written-down table also freezes offsets that the
 * whole point here is to compute.
 *
 * The stored value is the group's first city alphabetically — Europe/Amsterdam
 * for that row — except where the group contains plain `UTC`, which wins,
 * because "UTC" is the name someone looking for it will expect to see.
 */
export function timezoneGroups(now: Date = new Date()): TimezoneGroup[] {
	const year = now.getUTCFullYear();
	// Mid-month, mid-winter and mid-summer for the northern hemisphere. Southern
	// zones simply produce the reversed pair, which fingerprints them just as
	// well — Adelaide's (+10:30, +09:30) is as distinctive as Amsterdam's.
	const january = new Date(Date.UTC(year, 0, 15));
	const july = new Date(Date.UTC(year, 6, 15));

	const buckets = new Map<string, string[]>();

	for (const zone of timezoneNames()) {
		const key = `${timezoneOffsetMinutes(zone, january)}|${timezoneOffsetMinutes(zone, july)}`;
		const bucket = buckets.get(key);
		if (bucket) bucket.push(zone);
		else buckets.set(key, [zone]);
	}

	const groups = [...buckets.values()].map((zones) => {
		const sorted = [...zones].sort((a, b) =>
			timezoneCity(a).localeCompare(timezoneCity(b)));

		const value = sorted.includes("UTC") ? "UTC" : sorted[0]!;

		return {
			value,
			zones: sorted,
			// The stored zone's own name leads the row, so the label always
			// opens with the one the affiliate picked.
			cities: [timezoneCity(value), ...sorted.filter(z => z !== value).map(timezoneCity)],
			offsetLabel: timezoneOffsetLabel(value, now),
			offset: timezoneOffsetMinutes(value, now),
		};
	});

	return groups.sort((a, b) => a.offset - b.offset || a.cities[0]!.localeCompare(b.cities[0]!));
}

/**
 * Sort key placing zones west-to-east, so the list reads like a map rather than
 * an alphabet. Minutes from UTC, parsed back out of the label so there is only
 * one place that knows how an offset is worked out.
 */
export function timezoneOffsetMinutes(zone: string, now: Date = new Date()): number {
	const label = timezoneOffsetLabel(zone, now);
	const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(label);
	if (!match) return 0;

	const sign = match[1] === "-" ? -1 : 1;
	return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * The zone the browser is in, or null.
 *
 * Passed through `canonicalTimezone` because `resolvedOptions()` can answer with
 * a spelling the picker does not list, and an auto-detect that fills the field
 * with something the list cannot show is worse than one that declines.
 */
export function detectTimezone(): string | null {
	try {
		return canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
	}
	catch {
		return null;
	}
}
