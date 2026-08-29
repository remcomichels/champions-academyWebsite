<script setup>
</script>

<template>
	<div id="pageContainer">
		<div class="bgSun" aria-hidden="true" />
		<NuxtHeader />
		<main id="main" tabindex="-1">
			<NuxtPage />
		</main>
		<NuxtFooter />
		<!-- ClientOnly here rather than inside the component: it must skip the
		     setup as well as the render, or consent state lands in the SSR
		     payload and the page starts varying by cookie — which would make it
		     uncacheable and could serve one visitor's banner state to another. -->
		<ClientOnly>
			<NuxtConsentBanner />
		</ClientOnly>
	</div>
</template>

<style scoped>
</style>
