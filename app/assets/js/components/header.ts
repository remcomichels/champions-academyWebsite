import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { useStoryblokApi, useRoute, useNuxtApp } from "#imports";
import type Lenis from "lenis";
import type {
	HeaderMenuItem,
	CtaMenuItem,
} from "~/types/storyblok";

// Distance (px) the page must be scrolled before the header switches to its
// compact, frosted state.
const SCROLL_THRESHOLD = 24;

export function useHeader() {
	const storyblokApi = useStoryblokApi();

	const headerMenu = ref<HeaderMenuItem[]>([]);
	const ctaMenu = ref<CtaMenuItem[]>([]);

	const { locales, locale } = useI18n();
	const switchLocalePath = useSwitchLocalePath();
	const localePath = useLocalePath();

	const availableLocales = computed(() => locales.value);
	const currentLocale = computed(() => locale.value);

	const route = useRoute();
	const nuxtApp = useNuxtApp();
	const menuOpen = ref(false);

	// True once the page is scrolled past SCROLL_THRESHOLD — drives the frosted
	// background + inward nudge of the logo/CTA (styled via header.scrolled).
	const scrolled = ref(false);
	let stopScrollListener: (() => void) | null = null;

	const updateScrolled = (y: number) => {
		scrolled.value = y > SCROLL_THRESHOLD;
	};

	onMounted(() => {
		// Prefer Lenis' smoothed scroll value; fall back to native scroll if the
		// plugin isn't around (e.g. reduced-motion builds).
		const lenis = nuxtApp.$lenis;
		if (lenis?.on) {
			const onLenisScroll = (instance: Lenis) => updateScrolled(instance.scroll);
			lenis.on("scroll", onLenisScroll);
			stopScrollListener = () => lenis.off("scroll", onLenisScroll);
		}
		else {
			const onWindowScroll = () => updateScrolled(window.scrollY);
			window.addEventListener("scroll", onWindowScroll, { passive: true });
			stopScrollListener = () => window.removeEventListener("scroll", onWindowScroll);
		}
		updateScrolled(window.scrollY);
	});

	onBeforeUnmount(() => {
		stopScrollListener?.();
		stopScrollListener = null;
	});

	const setMenuOpen = (open: boolean) => {
		menuOpen.value = open;
		if (import.meta.client) {
			document.documentElement.classList.toggle("stop-scroll", open);
			// stop-scroll only blocks native scrolling — Lenis drives scrollTop
			// itself from wheel events, so it must be halted explicitly
			if (open) nuxtApp.$lenis?.stop();
			else nuxtApp.$lenis?.start();
		}
	};

	const toggleMenu = () => setMenuOpen(!menuOpen.value);

	// Close the mobile menu on navigation — fullPath, not path, so jumping to an
	// anchor on the page you're already on still closes it.
	watch(() => route.fullPath, () => setMenuOpen(false));

	onMounted(async () => {
		try {
			const { data } = await storyblokApi.get("cdn/stories/config", {
				version: "draft",
				resolve_links: "url",
			});

			headerMenu.value = data.story.content.header_menu ?? [];
			ctaMenu.value = data.story.content.cta_menu ?? [];
		}
		catch (error) {
			console.error("Error fetching header menu:", error);
		}
	});

	return {
		headerMenu,
		ctaMenu,
		availableLocales,
		currentLocale,
		localePath,
		switchLocalePath,
		menuOpen,
		toggleMenu,
		scrolled,
	};
}
