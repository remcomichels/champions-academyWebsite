import { ref, onMounted, computed } from "vue";
import { useStoryblokApi } from "#imports";
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
	};
}
