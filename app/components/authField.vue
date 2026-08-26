<template>
	<div class="field" :class="{ 'field--error': Boolean(error) }">
		<label class="field-label" :for="id">{{ label }}</label>

		<div class="field-control">
			<input
				:id="id"
				ref="input"
				class="field-input"
				:class="{ 'field-input--revealable': isPassword }"
				:type="inputType"
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

			<!-- type=button, or it submits the form it sits in. The label changes
			     with the state rather than staying "Toggle password", so a screen
			     reader announces what the next press will do. -->
			<button
				v-if="isPassword"
				type="button"
				class="field-reveal"
				:aria-label="revealed ? 'Hide password' : 'Show password'"
				:aria-pressed="revealed"
				:disabled="disabled"
				@click="revealed = !revealed"
			>
				<NuxtDashboardIcon :name="revealed ? 'eyeOff' : 'eye'" />
			</button>
		</div>

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

/**
 * Password reveal.
 *
 * Per field rather than per form: the sign-up form has three at once, and
 * revealing "new password" is not a request to reveal the current one beside
 * it. Always starts hidden — a field that remembered being revealed would
 * eventually show a password to whoever is standing behind you.
 */
const revealed = ref(false);
const isPassword = computed(() => props.type === "password");

// Swapped on the input rather than styled with -webkit-text-security, which
// Firefox does not implement and which leaves the value selectable as dots.
const inputType = computed(() => (isPassword.value && revealed.value ? "text" : props.type));

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
