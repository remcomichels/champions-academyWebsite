import type { Ref } from "vue";

/** The half of Lenis this needs, so the plugin's type is not imported for two methods. */
interface Scroller {
	stop: () => void;
	start: () => void;
}

/**
 * Holds the page still while a dialog is open.
 *
 * ── Why CSS is not enough ───────────────────────────────────────────────────
 * `showModal()` makes the rest of the document inert, and inert is not still —
 * the page behind still scrolls. The obvious fix is `overflow: hidden` on the
 * document, which dashboard.less does, and on its own it does not work here.
 *
 * Lenis is a global client plugin: it runs on every page, intercepts the wheel,
 * and scrolls by calling `window.scrollTo` itself. Programmatic scrolling is
 * not what `overflow: hidden` prevents, so with smooth scroll running the page
 * slid away behind the dialog exactly as before. Measured, not assumed.
 *
 * So the two layers are complementary rather than redundant: `stop()` takes the
 * wheel and touch, and the CSS takes the keyboard — PageDown, space and the
 * arrows are native scrolling that Lenis never sees — and covers the case where
 * Lenis is not running at all.
 *
 * ── Restoring it ────────────────────────────────────────────────────────────
 * `start()` runs on close and again on unmount. The second is not paranoia: a
 * dialog can be open when its page navigates away — a link inside it, a session
 * expiring, an admin bounced by middleware — and a Lenis left stopped is a site
 * that silently will not scroll, on every page, until reload.
 */
export function useScrollLock(open: Ref<boolean>) {
	// Undefined during SSR and in any context without the client plugin, which
	// is why every call below is guarded rather than assumed.
	const scroller = () => (useNuxtApp().$lenis as Scroller | undefined);

	watch(open, (isOpen) => {
		const lenis = scroller();
		if (!lenis) return;

		if (isOpen) lenis.stop();
		else lenis.start();
	});

	onUnmounted(() => {
		if (!open.value) return;
		scroller()?.start();
	});
}
