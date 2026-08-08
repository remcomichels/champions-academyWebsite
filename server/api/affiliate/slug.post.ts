import { object, str } from "../../utils/validate";

/** Matches the CHECK constraint on affiliates.slug. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/;

/** One change a month. */
const COOLDOWN_DAYS = 30;

/** How long the old slug keeps working afterwards. */
const ALIAS_GRACE_DAYS = 90;

/**
 * Changes the affiliate's public `?r=` slug.
 *
 * A slug is not a username — it is printed on QR codes, read aloud in videos,
 * and pasted into bios. So changing it does two things beyond the rename:
 *
 *  - the old slug keeps resolving for 90 days, so links already in the wild
 *    do not die the moment someone rebrands;
 *  - changes are limited to one a month, because every change leaves another
 *    alias behind and a slug that moves weekly is one nobody can rely on.
 *
 * Attribution is unaffected: conversions and visits are keyed on the affiliate
 * id, never the slug.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);

	const body = await readValidatedBody(event, object({
		slug: str({ min: 2, max: 32 }),
	}));

	const slug = body.slug.toLowerCase().trim();

	const reject = (message: string) =>
		createError({ statusCode: 400, statusMessage: message, data: { field: "slug", message } });

	if (!SLUG_RE.test(slug)) {
		throw reject("Use 2–32 lowercase letters, numbers and dashes, not starting or ending with a dash");
	}

	if (slug === affiliate.slug) {
		throw reject("That's already your link");
	}

	// Cooldown.
	if (affiliate.slug_changed_at) {
		const next = new Date(affiliate.slug_changed_at).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
		if (Date.now() < next) {
			throw reject(`You can change this again on ${new Date(next).toLocaleDateString("en-GB")}`);
		}
	}

	// Taken by another affiliate, or by a reserved slug seeded as revoked.
	const { data: clash } = await db()
		.from("affiliates")
		.select("id")
		.eq("slug", slug)
		.maybeSingle();

	if (clash) throw reject("That link is already taken");

	// Or still held by somebody else's alias inside its grace period.
	const { data: aliasClash } = await db()
		.from("affiliate_slug_aliases")
		.select("affiliate_id")
		.eq("slug", slug)
		.gt("expires_at", new Date().toISOString())
		.maybeSingle();

	if (aliasClash && aliasClash.affiliate_id !== affiliate.id) {
		throw reject("That link is already taken");
	}

	const previous = affiliate.slug;
	const expiresAt = new Date(Date.now() + ALIAS_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

	// Alias first. If this succeeds and the rename fails, the affiliate keeps
	// their current slug and gains a redundant alias pointing at themselves —
	// harmless. The other order would briefly orphan every existing link.
	const { error: aliasError } = await db()
		.from("affiliate_slug_aliases")
		.upsert(
			{ slug: previous, affiliate_id: affiliate.id, expires_at: expiresAt },
			{ onConflict: "slug" },
		);

	if (aliasError) {
		throw createError({ statusCode: 500, statusMessage: "Could not reserve your old link" });
	}

	const { error } = await db()
		.from("affiliates")
		.update({ slug, slug_changed_at: new Date().toISOString() })
		.eq("id", affiliate.id);

	if (error) {
		throw reject("That link is already taken");
	}

	await audit(event, {
		actorKind: "affiliate",
		action: "slug.changed",
		subjectAffiliateId: affiliate.id,
		meta: { from: previous, to: slug },
	});

	return {
		slug,
		previousSlug: previous,
		previousWorksUntil: expiresAt,
		// The referral middleware caches slug lookups, so the new one is not
		// instantaneous. Saying so beats an affiliate testing it immediately and
		// concluding it is broken.
		propagationSeconds: 300,
	};
});
