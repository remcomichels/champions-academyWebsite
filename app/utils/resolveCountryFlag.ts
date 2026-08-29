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

// ─────────────────────────────────────────────────────────────────────────────
// resolveCountryFlagByCode
//
// The same artwork, reached by ISO 3166-1 alpha-2 instead of by name. The
// dashboard's country figures come out of the visitor data as codes ("nl"),
// not as Storyblok option values ("netherlands"), and there are 322 of them —
// far too many for the hand-maintained map above, and not knowable in advance
// since any country can turn up in an affiliate's traffic.
//
// So the whole set is generated into public/images/flags/iso/ and addressed by
// code. The codes are listed here rather than the path being built blind: a
// country with no artwork has to return null so the caller renders no mark at
// all, instead of an <img> pointing at a 404.
// ─────────────────────────────────────────────────────────────────────────────

const ISO_FLAGS = new Set(`
	aa ab ac ad ae af ag ai ak al am an ao aq ar as at au av aw ax ay
	az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz
	ca cc cd ce cf cg ch ci ck cl cm cn co cp cq cr cs cu cv cw cx cy
	cz da de dg dj dk dm do dv dz ea ec ee eg eh el en eo er es et eu
	fa fi fj fk fm fo fr fx fy ga gb gd ge gf gg gh gi gl gm gn gp gq
	gr gs gt gu gv gw gy ha he hi hk hm hn ho hr ht hu hy ia ic id ie
	ig il im in io iq ir is it ja je jm jo jp jv ka ke kg kh ki kk kl
	km kn ko kp kr ks ku kv kw ky kz la lb lc lg li lk ln lo lr ls lt
	lu lv ly ma mc md me mf mg mh mi mk ml mm mn mo mp mq mr ms mt mu
	mv mw mx my mz na nb nc nd ne nf ng ni nl nn no np nr nu ny nz oc
	om or os pa pe pf pg ph pk pl pm pn pr ps pt pw py qa qu re rm rn
	ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sq sr ss st
	su sv sw sx sy sz ta tc td te tf tg th ti tj tk tl tm tn to tr tt
	tv tw ty tz ua ug uk um un ur us uy uz va vc ve vg vi vn vo vu wf
	ws xh xk xx ye yi yo yt yu za zh zm zu zw
`.trim().split(/\s+/));

/** Returns the circle-flag SVG path for an ISO 3166-1 alpha-2 code, or null. */
export function resolveCountryFlagByCode(code?: string | null): string | null {
	if (!code) return null;

	const key = code.toLowerCase().trim();
	if (!ISO_FLAGS.has(key)) return null;

	return `/images/flags/iso/${key}.svg`;
}
