<template>
	<div class="field" :class="{ 'field--error': Boolean(error) }">
		<label class="field-label" :for="id">{{ label }}</label>

		<input
			:id="id"
			ref="input"
			class="field-input"
			:type="type"
			:value="modelValue"
			:autocomplete="autocomplete"
			:inputmode="inputmode"
			:placeholder="placeholder"
			:required="required"
			:disabled="disabled"
			:aria-invalid="Boolean(error)"
			:aria-describedby="describedBy"
			:spellcheck="false"
			@input="onInput"
		>

		<p v-if="error" :id="`${id}-error`" class="field-message field-message--error" role="alert">
			{{ error }}
		</p>
		<p v-else-if="hint" :id="`${id}-hint`" class="field-message">
			{{ hint }}
		</p>
	</div>
</template>

<script setup lang="ts">
/**
 * The form input primitive.
 *
 * There were no forms in this codebase before the dashboard, so this is where
 * the pattern gets set. Two things it must not lose:
 *
 *  - `_reset.less` sets `:focus { outline: none }` globally, so the visible
 *    focus ring is restated in `form.less`. Without it the form is unusable by
 *    keyboard and fails WCAG 2.4.7.
 *  - The error is wired to the input with `aria-describedby` and `role=alert`,
 *    so a screen reader announces it instead of it being a red string only
 *    sighted users get.
 */
const props = withDefaults(defineProps<{
	label: string;
	modelValue: string;
	type?: string;
	autocomplete?: string;
	inputmode?: "text" | "email" | "numeric";
	placeholder?: string;
	error?: string | null;
	hint?: string | null;
	required?: boolean;
	disabled?: boolean;
}>(), {
	type: "text",
	autocomplete: undefined,
	inputmode: undefined,
	placeholder: undefined,
	error: null,
	hint: null,
	required: false,
	disabled: false,
});

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const id = useId();
const input = useTemplateRef<HTMLInputElement>("input");

const describedBy = computed(() => {
	if (props.error) return `${id}-error`;
	if (props.hint) return `${id}-hint`;
	return undefined;
});

const onInput = (event: Event) => {
	emit("update:modelValue", (event.target as HTMLInputElement).value);
};

/** Lets the parent put the cursor on the first field that failed. */
defineExpose({ focus: () => input.value?.focus() });
</script>
