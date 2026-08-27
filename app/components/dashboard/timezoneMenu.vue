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
				<span class="tzMenu-current">{{ triggerLabel }}</span>
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
			     them — an inner scroller gets nothing unless it opts out. -->
			<ul
				ref="list"
				class="tzMenu-list"
				role="listbox"
				aria-label="Timezones"
				data-lenis-prevent
			>
				<!-- A mode, not a shortcut. Choosing it keeps the dashboard on
				     whatever zone the browser reports, so it stays right when
				     the affiliate travels — and it takes a tick like any other
				     row, because it is genuinely the current selection. -->
				<li v-if="detected">
					<button
						type="button"
						class="tzMenu-option tzMenu-option--auto"
						role="option"
						:aria-selected="auto"
						:class="{ 'is-selected': auto }"
						@click="pickAuto"
					>
						<span class="tzMenu-optionStack">
							<span class="tzMenu-optionLead">Auto detect</span>
							<span class="tzMenu-optionZone">{{ detectedLabel }}</span>
						</span>

						<NuxtDashboardIcon v-if="auto" name="check" class="tzMenu-check" />
					</button>
				</li>

				<li v-if="!matches.length" class="tzMenu-empty">
					Nothing matches “{{ query.trim() }}”. Try a city, or a region like Europe.
				</li>

				<li v-for="group in matches" :key="group.value">
					<button
						type="button"
						class="tzMenu-option"
						role="option"
						:aria-selected="!auto && group.zones.includes(modelValue)"
						:class="{ 'is-selected': !auto && group.zones.includes(modelValue) }"
						@click="pickGroup(group)"
					>
						<span class="tzMenu-optionStack">
							<span class="tzMenu-optionLead">{{ group.offsetLabel }}</span>
							<span class="tzMenu-optionZone">{{ cityList(group) }}</span>
						</span>

						<NuxtDashboardIcon
							v-if="!auto && group.zones.includes(modelValue)"
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
import type { TimezoneGroup } from "#shared/utils/timezone";
import {
	TIMEZONE_ALIASES,
	detectTimezone,
	timezoneGroups,
	timezoneLabel,
} from "#shared/utils/timezone";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

/**
 * Whether the zone should follow the browser.
 *
 * A cookie rather than a column, and deliberately so: auto-detect is a fact
 * about the *device*, not the account. Someone who turns it on at a desk in
 * Amsterdam and later opens the dashboard on a phone in Tokyo wants the phone
 * to say Tokyo — a server-side flag would drag one machine's answer onto every
 * other one. The resolved zone is still written to the database, because that
 * is what buckets the figures; this only records where it came from.
 */
const auto = useCookie<boolean>("ca_tz_auto", {
	default: () => false,
	maxAge: 60 * 60 * 24 * 365,
	sameSite: "lax",
	path: "/",
});

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
 * The grouped rows. Built once per open rather than per keystroke: it resolves
 * two `Intl.DateTimeFormat` calls for each of ~420 zones, which is far too much
 * to redo while somebody is typing.
 */
const groups = computed<TimezoneGroup[]>(() => (open.value ? timezoneGroups() : []));

const detected = computed(() => detectTimezone());
const detectedLabel = computed(() => (detected.value ? timezoneLabel(detected.value) : ""));

const triggerLabel = computed(() =>
	(auto.value && detected.value
		? `Auto · ${timezoneLabel(detected.value)}`
		: timezoneLabel(props.modelValue)));

/**
 * The row's cities, trimmed. A row can fold thirty names into it and printing
 * all of them would bury the offset that identifies it — three plus a count
 * says what the row covers without becoming the row.
 */
const SHOWN_CITIES = 3;

const cityList = (group: TimezoneGroup) => {
	const shown = group.cities.slice(0, SHOWN_CITIES).join(", ");
	const rest = group.cities.length - SHOWN_CITIES;
	return rest > 0 ? `${shown} +${rest} more` : shown;
};

/**
 * Matches on every city in a row, not just the ones shown — searching "Prague"
 * has to find the row Prague is folded into even though the label stops at
 * Amsterdam. Also matches the offset, so "+02" narrows, and the alias table, so
 * "Kolkata" reaches the row holding `Asia/Calcutta`.
 */
const matches = computed(() => {
	const term = query.value.trim().toLowerCase();
	if (!term) return groups.value;

	return groups.value.filter(group =>
		group.offsetLabel.toLowerCase().includes(term)
		|| group.cities.some(city => city.toLowerCase().includes(term))
		|| group.zones.some(zone =>
			zone.toLowerCase().replace(/_/g, " ").includes(term)
			|| (TIMEZONE_ALIASES[zone]?.toLowerCase().includes(term) ?? false)));
});

const close = () => { open.value = false; };

const show = async ({ focus = true } = {}) => {
	if (open.value) return;

	open.value = true;
	query.value = "";
	measure();

	await nextTick();
	// Scrolls the chosen row into view — with 57 of them the current one is
	// rarely near the top, and opening on a list that does not show it reads as
	// having no selection at all.
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

/**
 * Picking a row stores its representative zone — unless the affiliate's current
 * zone is already inside that row, in which case nothing is written. Every zone
 * in a row keeps identical time, so rewriting `Europe/Warsaw` to
 * `Europe/Amsterdam` would change the stored value without changing a single
 * figure, and lose the more specific name for nothing.
 */
const pickGroup = (group: TimezoneGroup) => {
	auto.value = false;

	if (!group.zones.includes(props.modelValue)) emit("update:modelValue", group.value);
	close();
};

const pickAuto = () => {
	if (!detected.value) return;

	auto.value = true;
	if (detected.value !== props.modelValue) emit("update:modelValue", detected.value);
	close();
};

/**
 * Keeps a device on auto honest. If the browser has moved since the zone was
 * last written — a laptop opened in another country — this catches it up on
 * mount rather than waiting for someone to open the menu and notice.
 */
onMounted(() => {
	if (auto.value && detected.value && detected.value !== props.modelValue) {
		emit("update:modelValue", detected.value);
	}
});

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
