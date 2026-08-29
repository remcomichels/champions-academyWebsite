/**
 * Records that the affiliate has taken their referral link.
 *
 * Copying to the clipboard leaves no trace anywhere else, so this is the one
 * onboarding step that has to be reported by the client rather than derived
 * from real state. It only ever sets the flag — there is no way to unset it,
 * so a stray call cannot roll progress backwards.
 */
export default defineEventHandler(async (event) => {
	assertSameOrigin(event);

	const affiliate = await requireAffiliate(event);

	const onboarding = {
		...(affiliate.onboarding ?? {}),
		linkShared: true,
	};

	await db()
		.from("affiliates")
		.update({ onboarding })
		.eq("id", affiliate.id);

	setResponseStatus(event, 204);
	return null;
});
