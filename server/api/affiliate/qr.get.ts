import QRCode from "qrcode";

/**
 * QR code for the affiliate's referral link, as SVG.
 *
 * Generated server-side from the session's own slug — the affiliate cannot
 * pass in a URL to encode, which would otherwise turn this into a generator
 * for arbitrary QR codes served from our domain.
 *
 * SVG rather than PNG so it stays sharp when they drop it into a thumbnail or
 * print it, and it costs no image pipeline.
 */
export default defineEventHandler(async (event) => {
	const affiliate = await requireAffiliate(event);

	const svg = await QRCode.toString(referralUrl(event, affiliate.slug), {
		type: "svg",
		// Level M survives a logo overlay or a slightly blurry phone camera
		// without inflating the module count the way H does.
		errorCorrectionLevel: "M",
		margin: 2,
		color: {
			dark: "#0A0A0A",
			// Solid white rather than transparent: a transparent QR on a dark
			// background is unreadable to most scanners.
			light: "#FFFFFF",
		},
	});

	setResponseHeader(event, "content-type", "image/svg+xml; charset=utf-8");
	// Personal to this affiliate — must never land in a shared cache.
	setResponseHeader(event, "cache-control", "private, no-store, max-age=0");
	setResponseHeader(event, "content-disposition", `inline; filename="${affiliate.slug}-qr.svg"`);

	return svg;
});
