<template>
	<div class="field tzField" :class="{ 'field--error': Boolean(error), 'is-open': open }">
		<label class="field-label" :for="id">{{ label }}</label>

		<div class="tzField-control">
			<input
				:id="id"
				ref="input"
				class="field-input tzField-input"
				type="text"
				role="combobox"
				autocomplete="off"
				aria-autocomplete="list"
				:spellcheck="false"
				:value="query"
				:placeholder="placeholder"
				:aria-expanded="open"
				:aria-controls="`${id}-list`"
				:aria-activedescendant="activeId"
				:aria-invalid="Boolean(error)"
				:aria-describedby="describedBy"
				@input="onInput"
				@focus="onFocus"
				@blur="onBlur"
				@keydown="onKeydown"
			>

			<!-- mousedown.prevent, not click: the input's own blur fires first
			     otherwise, which closes the list out from under the pointer and
			     the option never receives the click at all. -->
			<ul
				v-if="open"
				:id="`${id}-list`"
				ref="listbox"
				class="tzField-list"
				role="listbox"
				:aria-label="`${label} options`"
			>
				<li v-if="!matches.length" class="tzField-empty">
					Nothing matches “{{ query.trim() }}”. Try a city, or a region like Europe.
				</li>

				<li
					v-for="(zone, index) in matches"
					:id="`${id}-o${index}`"
					:key="zone.id"
					class="tzField-option"
					:class="{ 'is-active': index === active, 'is-selected': zone.id === modelValue }"
					role="option"
					:aria-selected="zone.id === modelValue"
					@mousedown.prevent="choose(zone.id)"
					@mousemove="active = index"
				>
					<span class="tzField-name">{{ zone.label }}</span>
					<span class="tzField-offset">{{ zone.offset }}</span>
				</li>
			</ul>
		</div>

		<p v-if="error" :id="`${id}-error`" class="field-message field-message--error" role="alert">
			{{ error }}
		</p>
		<p v-else :id="`${id}-hint`" class="field-message">
			{{ hint }}
			<!-- The one-click answer for almost everyone. Hidden once it is
			     already the saved value, so it never reads as an unfinished
			     task. -->
			<button
				v-if="deviceZone && deviceZone !== modelValue"
				type="button"
				class="tzField-detect"
				@click="choose(deviceZone)"
			>
				Use {{ deviceZone }}
			</button>
		</p>
	</div>
</template>

<script setup lang="ts">
/**
 * Timezone picker.
 *
 * This was a plain text field, which meant typing an exact IANA name from
 * memory — so "New York" was rejected and `America/New_York` was the only
 * thing that worked. Now it searches: the query is matched against the whole
 * name, the city on its own with underscores read as spaces, and the current
 * UTC offset, so "new york", "amsterdam", "utc" and "gmt+2" all find something.
 *
 * The list comes from `Intl.supportedValuesOf`, so it is whatever the browser's
 * tz database actually contains rather than a hard-coded list that goes stale
 * when a country changes its rules.
 */
const props = withDefaults(defineProps<{
	label: string;
	modelValue: string;
	error?: string | null;
	hint?: string | null;
	placeholder?: string;
}>(), {
	error: null,
	hint: "Used for dates and times on your dashboard.",
	placeholder: "Search a city, region or UTC",
});

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

interface Zone {
	id: string;
	/** `America/New_York` reads as `America/New York`. */
	label: string;
	/** e.g. `GMT-4`. Empty when the engine cannot format one. */
	offset: string;
	/** Lowercased city segment, for ranking a match. */
	city: string;
	/** Everything searchable about the zone, lowercased. */
	haystack: string;
}

const id = useId();
const input = useTemplateRef<HTMLInputElement>("input");
const listbox = useTemplateRef<HTMLUListElement>("listbox");

const query = ref(props.modelValue);
const open = ref(false);
const active = ref(0);

/**
 * Built once, on the client, the first time the field is opened.
 *
 * Not at setup: there are ~450 zones and each offset costs an
 * `Intl.DateTimeFormat`, which is real work to do during hydration for a field
 * most visits never touch. Not during SSR either — it would ship the whole
 * list in the payload of a page that already knows the saved value.
 */
const zones = ref<Zone[]>([]);

const deviceZone = ref("");

onMounted(() => {
	// Every browser that runs this dashboard resolves its own zone; this is
	// only guarded because a locked-down engine may not.
	deviceZone.value = canonicalTimezone(
		Intl.DateTimeFormat().resolvedOptions().timeZone,
	) ?? "";
});

function buildZones(): Zone[] {
	const now = new Date();

	// Shared with the API's validator, so the list the field offers and the set
	// the server accepts cannot drift apart — and `UTC` is guaranteed to be in
	// it whatever the engine reports.
	return timezoneNames().map((zone) => {
		const label = zone.replace(/_/g, " ");
		const city = (label.split("/").pop() ?? label).toLowerCase();

		let offset = "";
		try {
			offset = new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "shortOffset" })
				.formatToParts(now)
				.find(part => part.type === "timeZoneName")?.value ?? "";
		}
		catch { /* leave the offset column blank for this one */ }

		return {
			id: zone,
			label,
			offset,
			city,
			// The raw id is in here too, so a pasted `America/New_York` still
			// matches even though the label spells it with a space, plus the
			// city's current name where the database still uses an older one.
			haystack: `${zone} ${label} ${offset} ${TIMEZONE_ALIASES[zone] ?? ""}`.toLowerCase(),
		};
	});
}

/**
 * Ranks an exact hit above a city that starts with the query, above a city
 * that merely contains it — so "york" puts New York above Yorkton, and "utc"
 * puts UTC itself above `Etc/UTC`-style neighbours.
 */
function rank(zone: Zone, needle: string): number {
	if (zone.id.toLowerCase() === needle) return 0;
	if (zone.city === needle) return 1;
	if (zone.city.startsWith(needle)) return 2;
	if (zone.id.toLowerCase().startsWith(needle)) return 3;
	if (zone.city.includes(needle)) return 4;
	return 5;
}

const matches = computed(() => {
	const needle = query.value.trim().toLowerCase();
	if (!needle) return zones.value;

	// Every word has to appear somewhere, so "york america" works as well as
	// "america york" and a stray space does not empty the list.
	const words = needle.split(/\s+/);
	const hits = zones.value.filter(zone => words.every(word => zone.haystack.includes(word)));

	return hits.sort((a, b) => rank(a, needle) - rank(b, needle) || a.id.localeCompare(b.id));
});

const activeId = computed(() =>
	(open.value && matches.value[active.value] ? `${id}-o${active.value}` : undefined));

const describedBy = computed(() => (props.error ? `${id}-error` : `${id}-hint`));

// While the field is closed it shows the saved value, so a save made elsewhere
// (or a reverted edit) is reflected rather than leaving stale text behind.
watch(() => props.modelValue, (value) => {
	if (!open.value) query.value = value;
});

function openList() {
	if (!zones.value.length) zones.value = buildZones();

	open.value = true;
	// Opens on the current selection rather than the top of the list, so the
	// first arrow press moves from where you are.
	active.value = Math.max(0, matches.value.findIndex(zone => zone.id === props.modelValue));
}

function onFocus() {
	openList();
	// Selects rather than clears: the value stays visible and readable, but the
	// first keystroke replaces it instead of appending to a name.
	input.value?.select();
}

function onInput(event: Event) {
	query.value = (event.target as HTMLInputElement).value;
	if (!open.value) openList();
	active.value = 0;
}

function choose(zone: string) {
	emit("update:modelValue", zone);
	query.value = zone;
	open.value = false;
}

/**
 * Leaving the field can never leave an unsaveable value behind.
 *
 * A name typed in full and tabbed away from is accepted — that is the whole
 * point of also allowing "UTC" — but anything the tz database does not
 * recognise reverts to the saved value instead of sitting in the box waiting
 * to be rejected by the API.
 */
function onBlur() {
	open.value = false;

	const typed = canonicalTimezone(query.value);
	if (typed && typed !== props.modelValue) choose(typed);
	else query.value = props.modelValue;
}

function move(delta: number) {
	if (!open.value) return openList();
	if (!matches.value.length) return;

	const count = matches.value.length;
	active.value = (active.value + delta + count) % count;

	nextTick(() => {
		listbox.value?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
	});
}

function onKeydown(event: KeyboardEvent) {
	switch (event.key) {
		case "ArrowDown":
			event.preventDefault();
			move(1);
			break;

		case "ArrowUp":
			event.preventDefault();
			move(-1);
			break;

		case "Enter": {
			// Only swallowed when it is picking something; otherwise the form
			// submits as it would from any other field.
			const picked = open.value ? matches.value[active.value] : undefined;
			if (!picked) break;

			event.preventDefault();
			choose(picked.id);
			break;
		}

		case "Escape":
			if (!open.value) break;
			// Stopped as well as prevented: the dashboard's mobile drawer
			// listens for Escape, and closing a dropdown should not also close
			// the navigation behind it.
			event.preventDefault();
			event.stopPropagation();
			open.value = false;
			query.value = props.modelValue;
			break;

		case "Tab":
			// Blur handles the commit; this just gets the list out of the way
			// before focus lands on the next control.
			open.value = false;
			break;
	}
}
</script>
