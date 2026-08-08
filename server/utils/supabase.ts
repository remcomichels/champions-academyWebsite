import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase access. Server-only, by design.
 *
 * Nothing in the browser talks to Supabase — the dashboard reads through
 * `/api/*` and gets live updates over SSE — so no key is ever sent to a
 * client. Do not import this file from anything under `app/`.
 */

let adminClient: SupabaseClient | null = null;

/**
 * The secret-key client. **Bypasses RLS.**
 *
 * Every query made with this must be scoped by the caller. For anything an
 * affiliate can reach, that scoping comes from `requireAffiliate()`, never
 * from a request parameter.
 */
export function db(): SupabaseClient {
	if (adminClient) return adminClient;

	const config = useRuntimeConfig();
	const url = config.supabaseUrl as string;
	const key = config.supabaseSecretKey as string;

	if (!url || !key) {
		throw createError({
			statusCode: 500,
			statusMessage: "Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY)",
		});
	}

	adminClient = createClient(url, key, {
		auth: {
			// No session storage on the server: every request is independent and
			// there is no browser to persist to.
			persistSession: false,
			autoRefreshToken: false,
		},
	});

	return adminClient;
}

/**
 * Verifies an email/password pair against Supabase Auth.
 *
 * We use Supabase purely as the credential store — it owns password hashing
 * and constant-time comparison — and mint our own opaque session afterwards.
 * A fresh publishable-key client is used per call so no state leaks between
 * requests.
 *
 * Returns the user id on success and `null` on bad credentials. Supabase
 * returns an identical error for "no such user" and "wrong password", so the
 * login form gives away nothing about which emails exist.
 */
export async function verifyPassword(
	email: string,
	password: string,
): Promise<{ userId: string; email: string } | null> {
	const config = useRuntimeConfig();
	const url = config.supabaseUrl as string;
	const key = config.supabasePublishableKey as string;

	if (!url || !key) {
		throw createError({
			statusCode: 500,
			statusMessage: "Supabase is not configured (SUPABASE_PUBLISHABLE_KEY)",
		});
	}

	const client = createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const { data, error } = await client.auth.signInWithPassword({ email, password });

	if (error || !data.user) return null;

	// GoTrue issued a refresh token we have no use for — our session is the
	// row in public.sessions, not this. Revoke it so it can't be replayed.
	// Safe to use global scope: nothing else in this system ever creates or
	// relies on a GoTrue session.
	try {
		await client.auth.signOut({ scope: "global" });
	}
	catch {
		// Best effort. A dangling unused refresh token is not worth failing a
		// login over, and it expires on its own.
	}

	return { userId: data.user.id, email: data.user.email ?? email };
}
