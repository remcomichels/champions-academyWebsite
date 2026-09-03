import type { ShallowRef } from "vue";

// ─────────────────────────────────────────────────────────────────────────────
// useDeferredScene
//
// Mounts a WebGL scene whose module is fetched on demand.
//
// The point of it is the dynamic import in `load`. three.js is 554 KB, and a
// static `import * as THREE` anywhere reachable from layouts/default.vue puts
// that 554 KB in the layout's chunk graph — which makes Nuxt emit a
// <link rel="modulepreload"> for it in the <head> of every marketing page,
// hero or no hero, menu opened or not. Reaching the module through an
// import() instead gives Rollup a chunk boundary to split on, so three is
// fetched by the component that actually draws something and by nothing else.
//
// `load` resolves to the scene's init function; init returns its own destroy,
// which is called on unmount.
// ─────────────────────────────────────────────────────────────────────────────

export function useDeferredScene(
	container: Readonly<ShallowRef<HTMLElement | null>>,
	load: () => Promise<(el: HTMLElement) => () => void>,
): void {
	let destroy: (() => void) | null = null;

	// The fetch can still be in flight when the component goes away — the header
	// mounts its logo inside a menu panel that can be closed again before a cold
	// cache has finished. Without this the scene would start after unmount, and
	// nothing would ever be left holding its destroy() to stop the render loop.
	let cancelled = false;

	onMounted(async () => {
		const init = await load();
		if (cancelled || !container.value) return;
		destroy = init(container.value);
	});

	onUnmounted(() => {
		cancelled = true;
		destroy?.();
		destroy = null;
	});
}
