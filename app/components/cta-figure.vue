<template>
	<div ref="container" class="cta-figure" aria-hidden="true" />
</template>

<script setup lang="ts">
import { initCtaFigure } from "~/assets/js/components/cta-figure";

const container = useTemplateRef<HTMLElement>("container");
let destroy: (() => void) | null = null;

onMounted(() => {
	if (container.value) destroy = initCtaFigure(container.value);
});

onUnmounted(() => {
	destroy?.();
	destroy = null;
});
</script>
