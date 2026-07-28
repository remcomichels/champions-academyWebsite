import type { RouterConfig } from '@nuxt/schema';

// Scroll handling. Normal navigations start at the top; anchor links (set via
// the "Anchor" input on a Storyblok link field, e.g. /about#pricing) ease down
// to the matching section instead. Lenis owns the scroll position, so the tween
// goes through it rather than the native scroll APIs.

// Extra breathing room under the fixed header, as a fraction of its height.
const HEADER_CLEARANCE = 1.25;

function headerOffset(): number {
	// The header's inner wrapper is the fixed bar; <header> itself is out of flow.
	const bar = document.querySelector<HTMLElement>('.headerWrapper');
	return bar ? bar.getBoundingClientRect().height * HEADER_CLEARANCE : 0;
}

export default {
	scrollBehavior(to, from) {
		if (!to.hash) return { top: 0, left: 0 };

		const nuxtApp = useNuxtApp();

		const scrollToHash = () => {
			let target: HTMLElement | null;
			try {
				target = document.querySelector<HTMLElement>(to.hash);
			}
			catch {
				return; // malformed anchor from the CMS — leave the scroll alone
			}
			if (!target) return;

			const offset = -headerOffset();
			const lenis = nuxtApp.$lenis;

			if (lenis) {
				lenis.scrollTo(target, { offset });
				return;
			}

			const top = target.getBoundingClientRect().top + window.scrollY + offset;
			window.scrollTo({ top, behavior: 'smooth' });
		};

		if (to.path === from.path) {
			// Same page — the section is already rendered.
			requestAnimationFrame(scrollToHash);
		}
		else {
			// Wait for the incoming page (and its blocks) to render first.
			nuxtApp.hooks.hookOnce('page:finish', () => {
				requestAnimationFrame(() => requestAnimationFrame(scrollToHash));
			});
		}

		// Scrolling is handled above — tell vue-router to stay put.
		return false;
	},
} satisfies RouterConfig;
