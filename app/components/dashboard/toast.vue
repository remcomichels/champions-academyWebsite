<template>
	<Teleport to="body">
		<div class="toasts toasts--interactive" aria-live="polite" aria-atomic="false">
			<div v-if="visible" class="toast" :class="`toast--${variant}`" role="status">
				<span class="toast-text"><slot /></span>

				<button type="button" class="toast-close" aria-label="Dismiss" @click="dismiss">
					<NuxtDashboardIcon name="close" class="toast-glyph" />
				</button>
			</div>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
/**
 * A message about something that just happened, bottom right.
 *
 * It used to be a banner at the top of the settings column, which had two
 * problems: it pushed every card down the moment it appeared, and on a long tab
 * it announced the result of a save that had scrolled out of sight.
 *
 * Teleported to the body because `.toasts` is `position: fixed`, and a fixed
 * element inside a transformed or filtered ancestor is positioned against that
 * ancestor instead of the viewport. Nothing in the settings column does that
 * today, but a toast that quietly stops being bottom-right when somebody adds a
 * transition to a panel is a bad way to find out.
 */
const props = withDefaults(defineProps<{
	/** Re-shows and restarts the timer whenever this changes. */
	message: string;
	variant?: "success" | "error" | "warning" | "info";
	/** Milliseconds on screen. Zero keeps it up until dismissed. */
	duration?: number;
}>(), { variant: "info", duration: 8000 });

const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const clear = () => {
	if (timer) clearTimeout(timer);
	timer = null;
};

const dismiss = () => {
	clear();
	visible.value = false;
};

/**
 * Keyed on the message rather than on a boolean, so saving twice in a row shows
 * a second toast with a fresh eight seconds instead of leaving the first one to
 * expire on its original schedule.
 */
watch(() => props.message, (text) => {
	clear();
	visible.value = Boolean(text);

	if (visible.value && props.duration > 0) {
		timer = setTimeout(() => { visible.value = false; }, props.duration);
	}
}, { immediate: true });

onUnmounted(clear);
</script>
