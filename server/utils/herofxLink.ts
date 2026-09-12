import type { H3Event } from "h3";

/**
 * Linking an affiliate to their HeroFX partner code.
 *
 * HeroFX offer no "sign in with HeroFX" of any kind — we have a read-only data
 * feed and nothing else — so the connection is made by matching addresses.
 * Sub-IBs are HeroFX clients themselves, so the feed knows the address of
 * whoever owns each partner code. An affiliate who signs in to the dashboard
 * with that same address is that person.
 *
 * The comparison is between fingerprints, never addresses: `herofx_clients`
 * stores an HMAC of the owner's address (see server/utils/herofx.ts) and this
 * hashes the affiliate's login address the same way. Nothing has to hold a
 * client's email for the match to work.
 *
 * ── What it will not do ─────────────────────────────────────────────────────
 * Touch a code an admin set by hand. That is the fallback for the affiliates
 * whose two addresses differ, and an automatic process that overwrites it
 * would undo the fix every five minutes.
 *
 * It also never *clears* a code it once set. A code that has left the
 * structure simply has no clients under it any more, and an empty dashboard
 * says that better than an account that silently unlinks itself.
 */
export interface LinkResult {
	/** Accounts newly pointed at a code, or moved to a different one. */
	linked: number;
	/** Matches refused because another affiliate already holds that code. */
	conflicts: number;
}

export async function linkAffiliatesByEmail(event: H3Event): Promise<LinkResult> {
	const { data: affiliates, error } = await db()
		.from("affiliates")
		.select("id, user_id, herofx_code, herofx_code_source")
		.eq("status", "active")
		.not("user_id", "is", null);

	if (error) throw new Error(`link: could not read affiliates: ${error.message}`);

	// Only accounts that could still change. An admin-set code is final, and an
	// account with no login has no address to match on.
	const candidates = (affiliates ?? []).filter(row =>
		row.user_id && row.herofx_code_source !== "admin");

	if (!candidates.length) return { linked: 0, conflicts: 0 };

	const emails = await emailsByUserId();

	// Fingerprint per affiliate, and the reverse map to get back from a match.
	const wanted = new Map<string, { id: string; code: string | null }[]>();

	for (const row of candidates) {
		const email = emails.get(row.user_id as string);
		if (!email) continue;

		const fingerprint = emailFingerprint(email);
		const list = wanted.get(fingerprint) ?? [];
		list.push({ id: row.id as string, code: (row.herofx_code as string | null) ?? null });
		wanted.set(fingerprint, list);
	}

	if (!wanted.size) return { linked: 0, conflicts: 0 };

	const { data: owners, error: ownerError } = await db()
		.from("herofx_clients")
		.select("own_codes, email_fingerprint")
		.in("email_fingerprint", [...wanted.keys()]);

	if (ownerError) throw new Error(`link: could not read code owners: ${ownerError.message}`);

	let linked = 0;
	let conflicts = 0;

	for (const owner of owners ?? []) {
		const fingerprint = owner.email_fingerprint as string | null;
		// Only rows that own a code carry a fingerprint at all, but the array is
		// what actually decides — a client with none is not an IB.
		const codes = (owner.own_codes as string[] | null) ?? [];
		if (!fingerprint || !codes.length) continue;

		// The first code, where somebody holds several. The dashboard reports on
		// one, and a person with two codes is rare enough to settle by hand —
		// an admin entry wins over this and is never overwritten.
		const code = codes[0]!;

		for (const affiliate of wanted.get(fingerprint) ?? []) {
			if (affiliate.code === code) continue;

			const { error: updateError } = await db()
				.from("affiliates")
				.update({
					herofx_code: code,
					herofx_code_source: "email",
					herofx_linked_at: new Date().toISOString(),
				})
				.eq("id", affiliate.id);

			if (updateError) {
				// 23505 is the unique index: another affiliate already holds this
				// code. Two accounts sharing one code would each be shown the
				// other's downline, so the second one is refused and left
				// unlinked rather than quietly taking it over.
				if (updateError.code === "23505") {
					conflicts++;
					console.error(`[herofx] code ${code} is already linked to another affiliate`);
					continue;
				}
				throw new Error(`link: could not link affiliate: ${updateError.message}`);
			}

			linked++;

			await audit(event, {
				actorKind: "system",
				action: "herofx.linked",
				subjectAffiliateId: affiliate.id,
				// The code, because it decides what that account can see. Not the
				// address or its fingerprint: one is personal data and the other
				// is a lookup key for it.
				meta: { code, via: "email" },
			});
		}
	}

	return { linked, conflicts };
}

/**
 * Every login address, by user id.
 *
 * Supabase's admin API has no bulk lookup — `listUsers` takes a page and a
 * size — so this pages through. The population here is affiliates and admins,
 * not customers, so it is a couple of requests at most; the cap stops it
 * walking forever if that ever stops being true. Same shape as
 * `findUserByEmail` in auth.ts, and deliberately not shared with it: that one
 * stops at the first match and this one needs all of them.
 */
async function emailsByUserId(): Promise<Map<string, string>> {
	const emails = new Map<string, string>();
	const perPage = 200;
	const maxPages = 25;

	for (let page = 1; page <= maxPages; page++) {
		const { data, error } = await db().auth.admin.listUsers({ page, perPage });

		if (error) throw new Error(`link: could not list accounts: ${error.message}`);

		const users = data?.users ?? [];
		for (const user of users) {
			if (user.email) emails.set(user.id, user.email);
		}

		if (users.length < perPage) break;
	}

	return emails;
}
