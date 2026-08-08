<template>
	<div class="copyField">
		<code class="copyField-value">{{ value }}</code>
		<button
			type="button"
			class="copyField-button"
			:disabled="!value"
			@click="copy"
		>
			{{ copied ? "Copied" : "Copy" }}
		</button>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{ value: string | null }>();
const emit = defineEmits<{ copied: [] }>();

const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | null = null;

async function copy() {
	if (!props.value) return;

	try {
		await navigator.clipboard.writeText(props.value);
	}
	catch {
		// Clipboard API needs a secure context and can be refused outright.
		// Selecting the text is a worse but working fallback, and silently
		// doing nothing is the one outcome that must not happen.
		const range = document.createRange();
		const node = document.querySelector(".copyField-value");
		if (node) {
			range.selectNodeContents(node);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
		}
		return;
	}

	copied.value = true;
	emit("copied");

	if (resetTimer) clearTimeout(resetTimer);
	resetTimer = setTimeout(() => { copied.value = false; }, 2000);
}

onUnmounted(() => {
	if (resetTimer) clearTimeout(resetTimer);
});
</script>
