<template>
	<div ref="root" class="field">
		<span :id="`${id}-label`" class="field-label">{{ label }}</span>
		<p v-if="hint" class="field-message">{{ hint }}</p>

		<div class="field-control">
			<button
				:id="id"
				ref="trigger"
				type="button"
				class="field-input field-input--select"
				:class="{ 'is-open': open }"
				:disabled="disabled"
				aria-haspopup="listbox"
				:aria-expanded="open"
				:aria-labelledby="`${id}-label ${id}`"
				@click="toggle"
				@keydown="onTriggerKey"
			>
				<span class="field-input-value">{{ currentLabel }}</span>
				<NuxtDashboardIcon name="chevronDown" class="field-caret" />
			</button>

			<!-- Hung under the trigger and pinned to its left edge, free to run
			     wider than it to the right — an address is longer than the 40%
			     column the control sits in, and truncating the list is what makes
			     a picker impossible to pick from. -->
			<ul
				v-if="open"
				class="selectMenu"
				role="listbox"
				:aria-labelledby="`${id}-label`"
				:aria-activedescendant="`${id}-opt-${activeIndex}`"
			>
				<li
					v-for="(option, i) in options"
					:id="`${id}-opt-${i}`"
					:key="option.value"
					class="selectMenu-item"
					:class="{ 'is-active': i === activeIndex, 'is-chosen': option.value === modelValue }"
					role="option"
					:aria-selected="option.value === modelValue"
					@mouseenter="activeIndex = i"
					@click="choose(option.value)"
				>
					<span class="selectMenu-label">{{ option.label }}</span>
					<NuxtDashboardIcon v-if="option.value === modelValue" name="check" class="selectMenu-tick" />
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * A select that looks like the inputs beside it.
 *
 * The native control was the honest first version, but its popup is drawn by
 * the operating system: it cannot be told to sit under the field, cannot run
 * wider than it, and looks like a different design system on every platform.
 * This is the same control drawn by us.
 *
 * Rendered as a `.field` rather than wrapping one, so it lands in the settings
 * grid the same way `NuxtAuthField` does — label and hint in the left column,
 * control in the right — without that layout needing to know it is a select.
 */
export interface SelectOption {
	value: string;
	label: string;
}

const props = withDefaults(defineProps<{
	modelValue: string;
	options: SelectOption[];
	label: string;
	hint?: string;
	disabled?: boolean;
}>(), { hint: undefined, disabled: false });

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const id = `select-${useId()}`;

const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const activeIndex = ref(0);

const currentLabel = computed(() =>
	props.options.find(o => o.value === props.modelValue)?.label ?? props.modelValue);

const close = () => { open.value = false; };

function toggle() {
	if (props.disabled) return;
	open.value = !open.value;
	// Nothing is highlighted on open. Landing the highlight on the chosen option
	// meant the row was filled the moment the list appeared, so with a single
	// option every option was tinted and the list read as a differently
	// coloured box rather than as a menu. The tick already says which one is
	// chosen; the fill is for saying which one you are *about* to choose, and
	// until you move there is no such thing.
	if (open.value) activeIndex.value = -1;
}

function choose(value: string) {
	emit("update:modelValue", value);
	close();
	trigger.value?.focus();
}

/**
 * Keyboard, handled on the trigger because it keeps focus the whole time — the
 * list is `aria-activedescendant`, so there is one focus stop for the control
 * rather than one per option to tab through.
 */
function onTriggerKey(event: KeyboardEvent) {
	if (props.disabled) return;

	if (event.key === "Escape" && open.value) {
		event.preventDefault();
		close();
		return;
	}

	if (!open.value) {
		if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
			event.preventDefault();
			toggle();
		}
		return;
	}

	// From -1, down lands on the first option and up on the last, which is what
	// "nothing is highlighted yet" should do in either direction.
	if (event.key === "ArrowDown") {
		event.preventDefault();
		activeIndex.value = (activeIndex.value + 1) % props.options.length;
	}
	else if (event.key === "ArrowUp") {
		event.preventDefault();
		activeIndex.value = activeIndex.value <= 0
			? props.options.length - 1
			: activeIndex.value - 1;
	}
	else if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		const option = props.options[activeIndex.value];
		if (option) choose(option.value);
	}
}

// Click-outside and Escape, bound only while open — the same shape the account
// menu uses, so a closed picker costs the page no document listeners.
let cleanup: (() => void) | null = null;

watch(open, (isOpen) => {
	if (!import.meta.client) return;

	const onPointer = (event: PointerEvent) => {
		if (!root.value?.contains(event.target as Node)) close();
	};

	if (isOpen) {
		document.addEventListener("pointerdown", onPointer);
		cleanup = () => document.removeEventListener("pointerdown", onPointer);
	}
	else {
		cleanup?.();
		cleanup = null;
	}
});

onUnmounted(() => cleanup?.());
</script>
