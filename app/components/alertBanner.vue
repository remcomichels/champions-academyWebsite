<template>
	<div class="alert" :class="`alert--${variant}`" :role="variant === 'error' ? 'alert' : 'status'">
		<p class="alert-text">
			<slot />
		</p>
	</div>
</template>

<script setup lang="ts">
/**
 * Inline status message. Finally puts the @error / @success / @warning tokens
 * in _variables.less to use — they have been defined and unused since the
 * boilerplate.
 *
 * `role="alert"` only for errors: it interrupts a screen reader, which is
 * right for a failure and rude for a confirmation.
 */
withDefaults(defineProps<{
	variant?: "error" | "success" | "warning" | "info";
}>(), {
	variant: "info",
});
</script>
