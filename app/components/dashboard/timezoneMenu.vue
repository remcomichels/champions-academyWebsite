<template>
	<div
		ref="root"
		class="tzMenu"
		:class="{ 'is-open': open }"
		@pointerenter="onEnter"
		@pointerleave="onLeave"
	>
		<button
			type="button"
			class="profileMenu-item tzMenu-trigger"
			:aria-expanded="open"
			aria-haspopup="listbox"
			@click="toggle"
		>
			<NuxtDashboardIcon name="globe" />

			<span class="tzMenu-stack">
				<span class="tzMenu-heading">Timezone</span>
				<span class="tzMenu-current">{{ currentLabel }}</span>
			</span>

			<NuxtDashboardIcon name="chevronRight" class="tzMenu-caret" />
		</button>

		<!-- Opens to the left, top edge level with the trigger's. The menu it
		     lives in is already pinned to the right of the viewport, so a panel
		     hanging right would open off screen. -->
		<div
			v-if="open"
			class="tzMenu-panel"
			:style="panelStyle"
			@pointerenter="cancelClose"
		>
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

			<!-- `data-lenis-prevent` is what makes the wheel work in here.
			     Lenis is a global plugin with no route gating, so it intercepts
			     wheel events across the whole app and scrolls the page with
			     them — an inner scroller gets nothing unless it opts out, which
			     is what this attribute does. `_general.less` already carries the
			     rule for it; nothing had needed it until now. -->
			<ul
				ref="list"
				class="tzMenu-list"
				role="listbox"
				aria-label="Timezones"
				data-lenis-prevent
			>
				<!-- First in the list rather than pinned above it: it is one more
				     zone you can pick, and holding it apart made it read as a
				     control that did something else. -->
				<li v-if="detected">
					<button
						type="button"
						class="tzMenu-option tzMenu-option--detect"
						@click="useDetected"
					>
						<span class="tzMenu-optionStack">
							<span class="tzMenu-optionLead">Auto detect</span>
							<span class="tzMenu-optionZone">{{ detectedLabel }}</span>
						</span>
					</button>
				</li>

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
						<span class="tzMenu-optionLabel">{{ label(zone) }}</span>

						<!-- Only on the chosen one. An unselected row carries no
						     placeholder at all — a column of empty circles was
						     more furniture than the thing it was marking. -->
						<NuxtDashboardIcon
							v-if="zone === modelValue"
							name="check"
							class="tzMenu-check"
						/>
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
const list = ref<HTMLElement | null>(null);

/**
 * How tall the panel is allowed to be, measured rather than guessed.
 *
 * Its top is level with the trigger, so the room it has is whatever is left
 * between that row and the bottom of the window. That distance depends on how
 * far down the account menu the row happens to sit, which no CSS length can
 * express — a fixed `max-height` would either waste space on a tall window or
 * run off the bottom of a short one, and running off the bottom is exactly the
 * bug that made this list look unscrollable before.
 */
const maxHeight = ref<number | null>(null);

const panelStyle = computed(() =>
	(maxHeight.value ? { maxHeight: `${maxHeight.value}px` } : undefined));

const measure = () => {
	const rect = root.value?.getBoundingClientRect();
	if (!rect) return;

	// 16px of breathing room at the bottom of the window.
	maxHeight.value = Math.max(160, Math.round(window.innerHeight - rect.top - 16));
};

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

const show = async ({ focus = true } = {}) => {
	if (open.value) return;

	open.value = true;
	query.value = "";
	measure();

	await nextTick();
	// Scrolls the chosen zone into view — with ~420 of them the selected one is
	// almost never near the top, and opening on a list that does not show it
	// reads as having no selection at all.
	list.value?.querySelector(".is-selected")?.scrollIntoView({ block: "center" });

	if (!focus) return;
	input.value?.focus();
};

const toggle = () => (open.value ? close() : show());

/**
 * Opens on hover as well as on click.
 *
 * The close is delayed because the panel sits beside the row rather than under
 * it, and the pointer crosses a few pixels of the gap between them on the way
 * over. Without the grace period that gap reads as a `pointerleave` and the
 * panel shuts just as you reach for it.
 *
 * Focus is *not* taken on hover. Moving a mouse across a menu should not steal
 * the caret out from under a keyboard user who is part-way through the list; a
 * deliberate click still focuses the search field.
 */
const HOVER_CLOSE_MS = 180;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const cancelClose = () => {
	if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
};

const onEnter = (event: PointerEvent) => {
	// Touch fires pointerenter on tap, which would open and then immediately be
	// toggled shut again by the click behind it.
	if (event.pointerType === "touch") return;

	cancelClose();
	show({ focus: false });
};

const onLeave = (event: PointerEvent) => {
	if (event.pointerType === "touch") return;

	cancelClose();
	closeTimer = setTimeout(close, HOVER_CLOSE_MS);
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
		window.addEventListener("resize", measure);
		cleanup = () => {
			document.removeEventListener("pointerdown", onPointer);
			window.removeEventListener("resize", measure);
		};
	}
	else {
		cleanup?.();
		cleanup = null;
	}
});

let cleanup: (() => void) | null = null;

onUnmounted(() => {
	cleanup?.();
	cancelClose();
});
</script>
