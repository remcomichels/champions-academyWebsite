import type { ShallowRef } from "vue";

// ─────────────────────────────────────────────────────────────────────────────
// useDeferredScene
//
// Mounts a WebGL scene whose module is fetched on demand, once the element it
// draws into is near the viewport.
//
// Two separate deferrals, and both are needed:
//
// The dynamic import in `load`. three.js is 554 KB, and a static
// `import * as THREE` anywhere reachable from layouts/default.vue puts that
// 554 KB in the layout's chunk graph — which makes Nuxt emit a
// <link rel="modulepreload"> for it in the <head> of every marketing page,
// hero or no hero, menu opened or not. Reaching the module through an import()
// instead gives Rollup a chunk boundary to split on, so three is fetched by the
// component that actually draws something and by nothing else.
//
// The IntersectionObserver around it. Splitting the chunk stops it blocking the
// page, but a decoration a full screen below the fold still has no business
// spending a phone's bandwidth — or opening a WebGL context and running a
// render loop — before anyone has scrolled near it. The CTA figure in
// particular sits at the bottom of a long marketing page. Scenes already in
// view when they mount (the hero logo, the header's copy inside an opening
// menu) see the observer fire immediately and are unaffected.
//
// `load` resolves to the scene's init function; init returns its own destroy,
// which is called on unmount.
// ─────────────────────────────────────────────────────────────────────────────

/** Start fetching this far before the element actually reaches the viewport. */
const ROOT_MARGIN = "200px";

export function useDeferredScene(
	container: Readonly<ShallowRef<HTMLElement | null>>,
	load: () => Promise<(el: HTMLElement) => () => void>,
): void {
	let destroy: (() => void) | null = null;
	let observer: IntersectionObserver | null = null;

	// The fetch can still be in flight when the component goes away — the header
	// mounts its logo inside a menu panel that can be closed again before a cold
	// cache has finished. Without this the scene would start after unmount, and
	// nothing would ever be left holding its destroy() to stop the render loop.
	let cancelled = false;

	async function start(): Promise<void> {
		const init = await load();
		if (cancelled || !container.value) return;
		destroy = init(container.value);
	}

	onMounted(() => {
		const el = container.value;
		if (!el) return;

		// No observer to gate on: draw rather than not draw.
		if (!("IntersectionObserver" in window)) {
			void start();
			return;
		}

		observer = new IntersectionObserver((entries) => {
			if (!entries.some(entry => entry.isIntersecting)) return;

			// One scene per element — once it has been asked for there is
			// nothing left to watch.
			observer?.disconnect();
			observer = null;
			void start();
		}, { rootMargin: ROOT_MARGIN });

		observer.observe(el);
	});

	onUnmounted(() => {
		cancelled = true;
		observer?.disconnect();
		observer = null;
		destroy?.();
		destroy = null;
	});
}
