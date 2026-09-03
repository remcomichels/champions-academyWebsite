<template>
	<div ref="container" class="hero-logo" aria-hidden="true" />
</template>

<script setup lang="ts">
// Type-only, so it is erased at build time and pulls neither this module nor
// three.js into the chunk graph. The runtime import is the one below.
import type { HeroLogoOptions } from "~/assets/js/components/hero-logo";

const props = defineProps<{ framing?: HeroLogoOptions["framing"] }>();

const container = useTemplateRef<HTMLElement>("container");

useDeferredScene(container, async () => {
	const { initHeroLogo } = await import("~/assets/js/components/hero-logo");
	return el => initHeroLogo(el, { framing: props.framing });
});
</script>
