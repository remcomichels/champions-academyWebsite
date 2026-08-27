<template>
	<div ref="root" class="tzMenu" :class="{ 'is-open': open }">
		<button
			type="button"
			class="profileMenu-item tzMenu-trigger"
			:aria-expanded="open"
			aria-haspopup="listbox"
			@click="toggle"
		>
			<NuxtDashboardIcon name="globe" />
			<span class="tzMenu-current">{{ currentLabel }}</span>
			<NuxtDashboardIcon name="chevronLeft" class="tzMenu-caret" />
		</button>

		<!-- Opens to the left. The menu it lives in is already pinned to the
		     right edge of the viewport, so a panel hanging right would be off
		     screen; there is nothing but page to the left of it. -->
		<div v-if="open" class="tzMenu-panel">
			<div class="tzMenu-search">
				<NuxtDashboardIcon name="search" />
				<input
					ref="input"
					v-model="query"
					type="text"
					class="tzMenu-input"
					placeholder="Search a city or region"
					autocomplete="off"
					:spellcheck="false"
					aria-label="Search timezones"
					@keydown.escape.stop="close"
				>
			</div>

			<button type="button" class="tzMenu-detect" @click="useDetected">
				Use my current timezone
				<span v-if="detected" class="tzMenu-detected">{{ detectedLabel }}</span>
			</button>

			<ul class="tzMenu-list" role="listbox" aria-label="Timezones">
				<li v-if="!matches.length" class="tzMenu-empty">
					Nothing matches “{{ query.trim() }}”. Try a city, or a region like Europe.
				</li>

				<li v-for="zone in matches" :key="zone">
					<button
						type="button"
						class="tzMenu-option"
						role="option"
						:aria-selected="zone === modelValue"
						:class="{ 'is-selected': zone === modelValue }"
						@click="pick(zone)"
					>
						<span class="tzMenu-dot" :class="{ 'is-on': zone === modelValue }" aria-hidden="true" />
						{{ label(zone) }}
					</button>
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup lang="ts">
import {
	TIMEZONE_ALIASES,
	detectTimezone,
	timezoneLabel,
	timezoneNames,
	timezoneOffsetMinutes,
} from "#shared/utils/timezone";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

const open = ref(false);
const query = ref("");
const root = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);

/**
 * Every zone, ordered west to east rather than alphabetically, so scrolling the
 * list moves across the map. Offsets are resolved against *now*, which is what
 * makes the ordering and the labels agree with whatever DST rule is in force
 * today — see `timezoneOffsetLabel` for why nothing here is a stored table.
 *
 * Computed once per open rather than per keystroke: it is ~420 zones and each
 * one costs an `Intl.DateTimeFormat`, which is far too much to redo while
 * somebody is typing.
 */
const zones = computed(() => {
	if (!open.value) return [];

	const now = new Date();
	return timezoneNames()
		.map(zone => ({
			zone,
			label: timezoneLabel(zone, now),
			offset: timezoneOffsetMinutes(zone, now),
		}))
		.sort((a, b) => a.offset - b.offset || a.zone.localeCompare(b.zone));
});

const labels = computed(() => new Map(zones.value.map(entry => [entry.zone, entry.label])));

const label = (zone: string) => labels.value.get(zone) ?? timezoneLabel(zone);

const currentLabel = computed(() => timezoneLabel(props.modelValue));

const detected = computed(() => detectTimezone());
const detectedLabel = computed(() => (detected.value ? timezoneLabel(detected.value) : ""));

/**
 * Matches on the label, so typing "+02" or "UTC-5" narrows by offset as well as
 * by name, and on the alias table so the spelling the tz database files a city
 * under is not the only one that finds it — "Kolkata" reaches `Asia/Calcutta`.
 */
const matches = computed(() => {
	const term = query.value.trim().toLowerCase();
	if (!term) return zones.value.map(entry => entry.zone);

	return zones.value
		.filter(({ zone, label: text }) =>
			text.toLowerCase().includes(term)
			|| zone.toLowerCase().replace(/_/g, " ").includes(term)
			|| (TIMEZONE_ALIASES[zone]?.toLowerCase().includes(term) ?? false))
		.map(entry => entry.zone);
});

const close = () => { open.value = false; };

const toggle = async () => {
	open.value = !open.value;
	if (!open.value) return;

	query.value = "";
	// After the panel exists, or there is nothing to focus yet.
	await nextTick();
	input.value?.focus();
};

const pick = (zone: string) => {
	emit("update:modelValue", zone);
	close();
};

const useDetected = () => {
	if (detected.value) pick(detected.value);
};

// Closes when the pointer goes anywhere outside this control — including
// elsewhere in the account menu, so opening another row puts this away.
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

let cleanup: (() => void) | null = null;
onUnmounted(() => cleanup?.());
</script>
