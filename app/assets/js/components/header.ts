import { ref, onMounted, computed, watch } from "vue";
import { useStoryblokApi, useRoute, useNuxtApp } from "#imports";
import type {
	HeaderMenuItem,
	CtaMenuItem,
} from "~/types/storyblok";

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

	// Close the mobile menu on navigation
	watch(() => route.path, () => setMenuOpen(false));

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
	};
}
