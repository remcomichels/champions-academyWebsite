import { ref, onMounted } from "vue";
import { useStoryblokApi } from "#imports";
import type { FooterMenu } from "~/types/storyblok";

// Footer content lives in the config story (same source as the header menu).
export function useFooter() {
	const storyblokApi = useStoryblokApi();

	const footer = ref<FooterMenu | null>(null);

	onMounted(async () => {
		try {
			const { data } = await storyblokApi.get("cdn/stories/config", {
				version: "draft",
				resolve_links: "url",
			});

			footer.value = data.story.content.footer_menu?.[0] ?? null;
		}
		catch (error) {
			console.error("Error fetching footer menu:", error);
		}
	});

	return { footer };
}
