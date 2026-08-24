<template>
	<div id="pageContainer" class="authLayout">
		<!-- NuxtPage, not <slot />: app.vue renders a bare <NuxtLayout />, so the
		     page is mounted by the layout rather than passed in as a slot. Using
		     a slot here renders an empty <main> with no error. -->
		<main id="main" tabindex="-1" class="authLayout-main">
			<NuxtPage />
		</main>
	</div>
</template>

<script setup lang="ts">
// No marketing header or footer: this page has one job, and the site nav is a
// row of exits from it.
//
// The green sun is gone too. Signing in is the front door to the dashboard, not
// the last page of the marketing site, and arriving on a green-on-black form
// before landing in a neutral dashboard reads as two different products. The
// accent wash in auth.less takes its place.
const { theme } = useTheme();

// Same reasoning as the dashboard layout: /login is `no-store`, so markup that
// varies by the theme cookie is never cached.
useHead({ htmlAttrs: { "data-theme": theme } });
</script>
