<template>
	<div class="avatar" :data-status="status">
		<!-- The renderer appends its own <span> here and removes only that on
		     destroy(), so this host stays ours to size and style. -->
		<div ref="host" class="avatar-host" />

		<!-- Shown only if the definition never arrived. Empty by default: the
		     caller decides whether a missing avatar needs replacing with
		     anything at all. -->
		<div v-if="status === 'error'" class="avatar-fallback">
			<slot name="fallback" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { useAvatar } from "~/assets/js/components/avatar";

const props = withDefaults(defineProps<{
	/** Path to the `.avatar.json` under `public/`. */
	definitionUrl: string;
	/** Animation key to autoplay, as named inside the definition. */
	animation?: string;
	size?: number | string;
	label?: string;
	/** `#rrggbb`, or a custom property name such as `--accent` to read it from. */
	bodyColor?: string;
}>(), {
	animation: undefined,
	size: "100%",
	label: "Champions Academy avatar",
	bodyColor: undefined,
});

const { host, status } = useAvatar({
	definitionUrl: props.definitionUrl,
	animation: props.animation,
	size: props.size,
	ariaLabel: props.label,
	bodyColor: props.bodyColor,
});

defineExpose({ status });
</script>
