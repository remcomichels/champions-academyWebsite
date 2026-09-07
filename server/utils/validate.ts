import type { H3Event } from "h3";

/**
 * Minimal request validation.
 *
 * Hand-rolled rather than pulling in zod: the surface is a handful of routes
 * with a few primitive fields each, and this keeps the serverless bundle small
 * and adds no type-inference dependency to a project already running `vue-tsc`
 * in dev. Shaped to match h3's `readValidatedBody`, so swapping in zod later
 * is a one-line change per route.
 */

export type Check<T> = (value: unknown, field: string) => T;

/**
 * How a field is named to the person who filled it in.
 *
 * The key is the wire name, which is the wrong thing to show: `passwordConfirm
 * must be at least 12 characters` is a sentence written for the API. Anything
 * missing here falls back to the key, so a new field degrades to the old
 * behaviour rather than to a blank.
 */
const FIELD_LABELS: Record<string, string> = {
	code: "Invite code",
	email: "Email",
	emailConfirm: "Confirm email",
	password: "Password",
	passwordConfirm: "Confirm password",
	currentPassword: "Current password",
	newPassword: "New password",
	firstName: "First name",
	lastName: "Last name",
	displayName: "Name",
	slug: "Link",
};

/** A 400 that names the offending field without echoing its value back. */
export function bad(field: string, message: string): ReturnType<typeof createError> {
	return createError({
		statusCode: 400,
		statusMessage: `${FIELD_LABELS[field] ?? field} ${message}`,
		data: { field, message },
	});
}

/**
 * `readValidatedBody`, with the error left intact.
 *
 * h3's version wraps *anything* the validator throws in a generic
 * `statusMessage: "Validation Error"` and buries the original in `data`
 * (createValidationError, h3/dist/index.mjs). So every sentence `bad()` builds
 * and every `field` the forms use to place the message under the right input
 * was being thrown away, and each of these routes answered a mistyped password
 * with the words "Validation Error".
 *
 * This runs the same check outside that catch, so the error the route meant to
 * send is the one that arrives.
 */
export async function readChecked<T>(event: H3Event, check: (value: unknown) => T): Promise<T> {
	return check(await readBody(event));
}

export const str = (
	opts: { min?: number; max?: number; pattern?: RegExp; trim?: boolean } = {},
): Check<string> => (value, field) => {
	if (typeof value !== "string") throw bad(field, "must be a string");
	const s = opts.trim === false ? value : value.trim();
	if (opts.min !== undefined && s.length < opts.min) {
		throw bad(field, `must be at least ${opts.min} characters`);
	}
	if (opts.max !== undefined && s.length > opts.max) {
		throw bad(field, `must be at most ${opts.max} characters`);
	}
	if (opts.pattern && !opts.pattern.test(s)) throw bad(field, "is not in the right format");
	return s;
};

/**
 * Deliberately loose. Real validation of an address is delivery, not a regex —
 * this only rejects obvious nonsense and caps length (RFC 5321 limit) so the
 * value is safe to hash and store.
 *
 * The shape test lives in `shared/utils/email.ts` because the account settings
 * dialog runs it too, to decide whether to show "Invalid email" before sending
 * anything. This copy is still the one that decides — the browser's is a
 * courtesy — but they have to agree, or a field passes locally and is refused
 * here.
 */
export const email = (): Check<string> => (value, field) => {
	const s = str({ max: EMAIL_MAX_LENGTH })(value, field).toLowerCase();
	if (!EMAIL_PATTERN.test(s)) throw bad(field, "is not a valid address");
	return s;
};

/**
 * Password rules follow NIST 800-63B: length is the only requirement. No
 * composition rules — they push people toward predictable substitutions.
 * The upper bound is a real guard, since the hash step is deliberately slow.
 */
export const password = (): Check<string> =>
	str({ min: 12, max: 128, trim: false });

/**
 * A password being *offered*, not chosen.
 *
 * Sign-in must not apply the composition rules — it is checking a credential
 * that already exists, not approving a new one. Running `password()` here made
 * a mistyped seven-character attempt answer "Password must be at least 12
 * characters", which states our policy to an unauthenticated caller and reads,
 * to someone whose password is fine, as though the form has broken.
 *
 * A wrong password is a wrong password: this only rejects an empty one, and
 * the 128 ceiling stays because the hash step is deliberately slow and an
 * unbounded input is a free way to spend it.
 */
export const passwordAttempt = (): Check<string> =>
	str({ min: 1, max: 128, trim: false });

/**
 * A human name, safe to render anywhere.
 *
 * Nothing in this codebase puts a display name through `v-html` today — Vue
 * escapes `{{ }}`, which is why a stored `<img src=x onerror=…>` was inert
 * when the audit tried it. That is a property of the render layer, not of the
 * data, and it is one `v-html` away from not being true. So the data is
 * cleaned here instead: markup characters are rejected, and the control
 * characters that let a name spoof a second line of UI are stripped.
 *
 * Rejected rather than silently stripped, because a name containing `<` is
 * almost certainly an attack or a paste accident, and quietly saving a
 * different name than the one typed is its own bug. Apostrophes, hyphens,
 * accents and non-Latin scripts all pass — the point is markup, not ASCII.
 */
export const displayName = (opts: { min?: number; max?: number } = {}): Check<string> => (value, field) => {
	const s = str({ ...opts, trim: false })(value, field)
		// eslint-disable-next-line no-control-regex -- stripping them is the point
		.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, "")
		// Collapse runs of whitespace so a name cannot be padded into a column
		// of its own, then trim.
		.replace(/\s+/g, " ")
		.trim();

	if (opts.min !== undefined && s.length < opts.min) {
		throw bad(field, `must be at least ${opts.min} characters`);
	}
	if (/[<>]/.test(s)) throw bad(field, "cannot contain < or >");

	return s;
};

export const uuid = (): Check<string> =>
	str({ pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i });

export const oneOf = <T extends string>(...allowed: T[]): Check<T> => (value, field) => {
	if (typeof value !== "string" || !allowed.includes(value as T)) {
		throw bad(field, `must be one of: ${allowed.join(", ")}`);
	}
	return value as T;
};

export const int = (opts: { min?: number; max?: number } = {}): Check<number> => (value, field) => {
	const n = typeof value === "string" ? Number(value) : value;
	if (typeof n !== "number" || !Number.isInteger(n)) throw bad(field, "must be an integer");
	if (opts.min !== undefined && n < opts.min) throw bad(field, `must be at least ${opts.min}`);
	if (opts.max !== undefined && n > opts.max) throw bad(field, `must be at most ${opts.max}`);
	return n;
};

export const optional = <T>(check: Check<T>): Check<T | null> => (value, field) => {
	if (value === undefined || value === null || value === "") return null;
	return check(value, field);
};

/**
 * Like `optional`, except an empty string is a value rather than an absence.
 *
 * `optional` folds "the client did not send this" and "the client sent it
 * empty" into the same `null`, which is right for most fields — a blank box is
 * a field you did not fill in. It is wrong for anything clearable. A route that
 * cannot tell the two apart has to fall back to the stored value, and then
 * emptying the box saves nothing and the old value comes back on the next load.
 *
 * Returns `undefined` only for a key that was genuinely absent, so
 * `!== undefined` means "the client had something to say about this field".
 */
export const whenPresent = <T>(check: Check<T>): Check<T | undefined> => (value, field) => {
	if (value === undefined || value === null) return undefined;
	return check(value, field);
};

type Shape = Record<string, Check<unknown>>;
type Infer<S extends Shape> = { [K in keyof S]: S[K] extends Check<infer T> ? T : never };

/**
 * Validates an object against a shape. Unknown keys are dropped rather than
 * rejected, so a field added by a newer client never 400s an older route.
 */
export const object = <S extends Shape>(shape: S) => (value: unknown): Infer<S> => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw createError({ statusCode: 400, statusMessage: "Body must be a JSON object" });
	}
	const input = value as Record<string, unknown>;
	const out = {} as Record<string, unknown>;
	for (const key of Object.keys(shape)) {
		out[key] = shape[key]!(input[key], key);
	}
	return out as Infer<S>;
};

/** Asserts two fields match — used for the email and password confirmations. */
export function assertMatches(a: string, b: string, field: string): void {
	if (a !== b) throw bad(field, "does not match");
}
