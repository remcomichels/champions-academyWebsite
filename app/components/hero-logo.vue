<template>
	<div ref="container" class="hero-logo" aria-hidden="true" />
</template>

<script setup lang="ts">
import { initHeroLogo, type HeroLogoOptions } from "~/assets/js/components/hero-logo";

const props = defineProps<{ framing?: HeroLogoOptions["framing"] }>();

const container = useTemplateRef<HTMLElement>("container");
let destroy: (() => void) | null = null;

onMounted(() => {
	if (container.value) destroy = initHeroLogo(container.value, { framing: props.framing });
});

onUnmounted(() => {
	destroy?.();
	destroy = null;
});
</script>
