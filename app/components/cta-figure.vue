<template>
	<div ref="container" class="cta-figure" aria-hidden="true" />
</template>

<script setup lang="ts">
const container = useTemplateRef<HTMLElement>("container");

useDeferredScene(container, async () => {
	const { initCtaFigure } = await import("~/assets/js/components/cta-figure");
	return initCtaFigure;
});
</script>
