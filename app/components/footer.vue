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
									v-if="linkHref(link)"
									:to="linkHref(link)!"
									v-bind="linkAttrs(link)"
									@click="onLinkClick(link)"
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

			<!-- Legal row. Its own line above the sub row rather than inline with
			     the copyright: two underlined controls dropped into a
			     space-between row read as part of the disclaimer sitting next to
			     them, and both of these are things a visitor comes to the footer
			     deliberately looking for.

			     Withdrawing consent has to be as easy as giving it, so the cookie
			     control is on every page rather than only in the policy. Its own
			     component inside ClientOnly: the composable reads a cookie, and
			     calling it from this file's setup would put consent state in the
			     SSR payload and make the page vary by cookie. ClientOnly skips
			     the render, not the setup, so the boundary has to sit above it. -->
			<div class="footer-legal">
				<NuxtLink to="/privacy" class="footer-legalLink">Privacy policy</NuxtLink>
				<ClientOnly>
					<NuxtCookieSettingsButton />
				</ClientOnly>
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

const { footer } = useFooter();

// Resolves each column link, applying link_role for the centrally managed ones
// (Telegram / book a call) and normal localised multilink resolution for the
// rest.
const { href: linkHref, attrs: linkAttrs, onClick: onLinkClick } = useMenuLink();

const year = new Date().getFullYear();

const columns = computed(() => {
	if (!footer.value) return [];
	return [
		{ title: footer.value.footer_titleLeft, links: footer.value.footer_linkLeft ?? [] },
		{ title: footer.value.footer_titleMiddle, links: footer.value.footer_linkMiddle ?? [] },
		{ title: footer.value.footer_titleRight, links: footer.value.footer_linkRight ?? [] },
	];
});

// Links with nothing set (e.g. social placeholders) resolve to null and render
// as plain text instead — see the v-if/v-else in the template.
</script>
