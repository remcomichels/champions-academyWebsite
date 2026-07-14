<script setup lang="ts">
// Initialize before any child component mounts so reveal animations wait for the intro.
// Persists as `true` across SPA navigations so subsequent pages animate immediately.
useState('introComplete', () => false)

// Intro plays once on first load (sets introComplete); page transitions run on
// every route change (toggles pageTransitioning). Both read their overlay from
// the markup below.
useIntro()
usePageTransition()

// Single global inview instance: reveals every [data-scroll-inview] section
// once the intro/transition is done. Blocks only need the attribute + CSS.
const { initInview } = useInview()
onMounted(() => initInview())
</script>

<template>
	<!-- Accessibility: skip-to-content link (visible on focus) + screen-reader route announcer -->
	<a class="skip-link" href="#main">Skip to content</a>
	<NuxtRouteAnnouncer />
	<!-- First-load intro overlay — server-rendered so it covers from first paint -->
	<div class="intro" />
	<!-- Route-change transition overlay — parked offscreen until a navigation runs -->
	<div class="pageTransition" />
	<NuxtLayout />
</template>
