<template>
	<div class="authLayout">
		<!-- NuxtPage, not <slot />: app.vue renders a bare <NuxtLayout />, so the
		     page is mounted by the layout rather than passed in as a slot. Using
		     a slot here renders an empty <main> with no error. -->
		<main id="main" tabindex="-1" class="authLayout-main">
			<NuxtPage />
		</main>
	</div>
</template>

<script setup lang="ts">
// The auth screens' stylesheet. Kept out of main.less — and so out of the CSS
// every marketing page downloads — and imported here instead, which is what
// scopes it to this layout. Nuxt inlines a layout's styles into the SSR'd HTML
// rather than emitting a <link>, so /login still arrives fully styled on first
// paint. See app/assets/less/auth.less.
import "~/assets/less/auth.less";

// No marketing header or footer: this page has one job, and the site nav is a
// row of exits from it.
//
// The green sun is gone too. Signing in is the front door to the dashboard, not
// the last page of the marketing site, and arriving on a green-on-black form
// before landing in a neutral dashboard reads as two different products. The
// accent wash in auth.less takes its place.
const { resolved: theme } = useTheme();

// Same reasoning as the dashboard layout: /login is `no-store`, so markup that
// varies by the theme cookie is never cached.
//
// `data-screen` is what auth.less hangs the scroll lock off. It has to be on
// <html> because that is the element that scrolls, and it cannot be `data-theme`
// — the dashboard sets that too, and the dashboard is supposed to scroll. An
// attribute rather than a class so it cannot collide with the `lenis` classes
// Lenis writes straight onto documentElement.
useHead({ htmlAttrs: { "data-theme": theme, "data-screen": "auth" } });
</script>
