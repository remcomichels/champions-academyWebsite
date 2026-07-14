import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default defineNuxtPlugin(() => {
	gsap.registerPlugin(ScrollTrigger);

	gsap.defaults({ ease: "power3.out" });

	// Late-loading content (videos, images, CMS embeds) can grow the document
	// after ScrollTriggers have measured, leaving pins/scrubs anchored to stale
	// positions. Watch the body height and re-measure when it settles.
	let lastBodyHeight = 0;
	let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
	const resizeObserver = new ResizeObserver((entries) => {
		const height = Math.round(entries[0]?.contentRect.height ?? 0);
		if (Math.abs(height - lastBodyHeight) < 2) return;
		lastBodyHeight = height;
		if (refreshTimeout) clearTimeout(refreshTimeout);
		refreshTimeout = setTimeout(() => ScrollTrigger.refresh(), 200);
	});
	resizeObserver.observe(document.body);

	return {
		provide: {
			gsap: gsap,
			ScrollTrigger: ScrollTrigger,
		},
	};
});
