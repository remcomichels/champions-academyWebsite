<template>
	<div ref="container" class="hero-logo" aria-hidden="true" />
</template>

<script setup lang="ts">
import { initHeroLogo } from "~/assets/js/components/hero-logo";

const container = useTemplateRef<HTMLElement>("container");
let destroy: (() => void) | null = null;

onMounted(() => {
	if (container.value) destroy = initHeroLogo(container.value);
});

onUnmounted(() => {
	destroy?.();
	destroy = null;
});
</script>
