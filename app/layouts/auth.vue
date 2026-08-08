<template>
	<div id="pageContainer" class="authLayout">
		<div class="bgSun" aria-hidden="true" />

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
// row of exits from it. The decorative sun stays so it still looks like the
// same brand.
</script>
