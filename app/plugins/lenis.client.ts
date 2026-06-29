import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default defineNuxtPlugin(() => {
	const lenis = new Lenis({
		lerp: 0.1, // smoothness (lower = smoother)
		wheelMultiplier: 1, // mouse wheel speed
		touchMultiplier: 1, // touch speed
	});

	// One rAF for the whole app (see composables/useRaf.ts). Instead of Lenis
	// running its own requestAnimationFrame loop, drive it from GSAP's ticker —
	// the same clock every tween and ScrollTrigger already uses.
	//
	// ticker time is in seconds; Lenis.raf() expects milliseconds.
	gsap.ticker.add((time) => lenis.raf(time * 1000));

	// Keep ScrollTrigger in sync with Lenis' smoothed scroll position. Without
	// this, scroll-driven triggers read the native scroll value and drift away
	// from where the page visually is.
	lenis.on("scroll", ScrollTrigger.update);

	// Lenis owns the frame pacing now, so disable GSAP's lag smoothing to avoid
	// it fighting Lenis after a dropped/backgrounded frame.
	gsap.ticker.lagSmoothing(0);

	if ('scrollRestoration' in history) {
		history.scrollRestoration = 'manual';
	}

	const router = useRouter();
	router.afterEach(() => {
		lenis.scrollTo(0, { immediate: true });
	});

	return {
		provide: {
			lenis,
		},
	};
});
