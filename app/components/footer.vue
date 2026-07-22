<!-- eslint-disable vue/multi-word-component-names -->
<template>
	<footer v-if="footer" class="footer">
		<div class="container footer-inner">
			<div class="footer-main">
				<div class="footer-brand">
					<NuxtAppImage
						v-if="footer.footer_image?.filename"
						:src="footer.footer_image.filename"
						:alt="footer.footer_image.alt || 'Champions Academy'"
						class="footer-logo"
					/>
					<p class="footer-subtitle">{{ footer.footer_subTitle }}</p>
				</div>

				<div class="footer-columns">
					<div v-for="(column, i) in columns" :key="i" class="footer-column">
						<p class="footer-column-title">{{ column.title }}</p>
						<ul class="footer-column-links">
							<li v-for="link in column.links" :key="link._uid">
								<NuxtLink
									v-if="linkPath(link)"
									:to="linkPath(link)!"
									class="footer-link parent-line"
								>
									{{ link.label }}
									<span class="link-line" />
								</NuxtLink>
								<span v-else class="footer-link">{{ link.label }}</span>
							</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="footer-sub">
				<p class="footer-copyright">&copy; {{ year }} Champions Academy</p>
				<p class="footer-disclaimer">{{ footer.subFooter_text }}</p>
				<p class="footer-credit">
					Crafted with care by
					<a
						href="https://www.remcola.nl"
						target="_blank"
						rel="noopener"
						class="footer-credit-link parent-link"
					>
						Remco
						<span class="link-line" />
					</a>
				</p>
			</div>
		</div>
	</footer>
</template>

<script setup lang="ts">
import { useFooter } from "~/assets/js/components/footer";
import type { MenuLinkItem } from "~/types/storyblok";

const { footer } = useFooter();
const localePath = useLocalePath();

const year = new Date().getFullYear();

const columns = computed(() => {
	if (!footer.value) return [];
	return [
		{ title: footer.value.footer_titleLeft, links: footer.value.footer_linkLeft ?? [] },
		{ title: footer.value.footer_titleMiddle, links: footer.value.footer_linkMiddle ?? [] },
		{ title: footer.value.footer_titleRight, links: footer.value.footer_linkRight ?? [] },
	];
});

// Returns a routable path for a menu link, or null when the story link is
// unset (e.g. social placeholders) — those render as plain text instead.
function linkPath(link: MenuLinkItem): string | null {
	const cached = link.link?.cached_url;
	if (!cached) return null;
	const clean = cached.replace(/^\/+|\/+$/g, "");
	return localePath(clean === "home" || clean === "" ? "/" : `/${clean}`);
}
</script>
