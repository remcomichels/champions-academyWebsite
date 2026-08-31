import { object, str } from "../../utils/validate";

/** One change a month. This is the only rule here the admin path does not share. */
const COOLDOWN_DAYS = 30;

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
 * Attribution is unaffected: visits and clicks are keyed on the affiliate id,
 * never the slug.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);

	const body = await readValidatedBody(event, object({
		slug: str({ min: 2, max: 32 }),
	}));

	const slug = normalizeSlug(body.slug);

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

	// Taken by another affiliate, by a reserved slug seeded as revoked, or by
	// somebody else's alias still inside its grace period.
	await assertSlugAvailable(slug, affiliate.id);

	const previous = affiliate.slug;
	const expiresAt = await reserveSlugAlias(previous, affiliate.id);

	const { error } = await db()
		.from("affiliates")
		.update({ slug, slug_changed_at: new Date().toISOString() })
		.eq("id", affiliate.id);

	if (error) {
		throw reject("That link is already taken");
	}

	// Under both names: the old one now resolves to a rename that has already
	// happened, and the new one may hold a miss from someone who tried it early.
	await invalidateAffiliateLinks(affiliate.id, previous);
	await invalidateAffiliateLinks(affiliate.id, slug);

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
		// Zero because the cached entries for both slugs were just dropped. It
		// used to be 300 — the TTL — which meant an affiliate who tested their
		// new link straight away got the old answer and concluded it was broken.
		propagationSeconds: 0,
	};
});
