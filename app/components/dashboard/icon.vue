<template>
	<svg
		class="icon"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		focusable="false"
	>
		<path v-for="(d, i) in paths" :key="i" :d="d" />
	</svg>
</template>

<script setup lang="ts">
/**
 * The dashboard icon set.
 *
 * Every glyph is expressed purely as path data — circles included, drawn as
 * arcs — so the template is a single `v-for` and nothing here needs `v-html`.
 * Inline rather than a sprite or an icon package: there are sixteen of them,
 * they are all one or two paths, and a dependency for that would be silly.
 *
 * `currentColor` throughout, so an icon takes the colour of whatever it sits
 * in and needs no theme handling of its own.
 */
const props = defineProps<{ name: string }>();

const icons: Record<string, string[]> = {
	// A panel with its divider about 30% in — the sidebar drawn as a picture of
	// itself. Box spans x 3–21, so the rule at 8.5 sits just left of centre.
	sidebar: [
		"M5.5 4h13a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11A2.5 2.5 0 0 1 5.5 4Z",
		"M8.5 4v16",
	],
	home: ["M3 10.6 12 3l9 7.6", "M5.5 9.6V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.6"],
	// A clock wound anticlockwise — the standard "history" glyph. The arc stops
	// short at the top left and the arrow head marks where it came from, which
	// is what separates it from a plain clock face.
	// The reveal toggle. Two arcs meeting at the corners rather than an ellipse,
	// so the lid keeps the same stroke weight as the pupil inside it.
	eye: [
		"M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z",
		"M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z",
	],
	// The same eye with a slash, not a different glyph: the two states have to
	// read as one control changing rather than two controls swapping.
	eyeOff: [
		"M9.9 5.2A9.6 9.6 0 0 1 12 5c5.9 0 9.5 6 9.5 6a17 17 0 0 1-2.8 3.4",
		"M6.2 6.7A17 17 0 0 0 2.5 11s3.6 6 9.5 6a9.4 9.4 0 0 0 3.9-.83",
		"M10.2 9.4a2.6 2.6 0 0 0 3.5 3.8",
		"M3.5 3.5l17 17",
	],
	// Two strokes inset to 6–18, so the X reads at the same weight as the
	// chevron rather than filling the box edge to edge.
	close: ["M6 6l12 12", "M18 6 6 18"],
	history: [
		"M3.5 9.5A9 9 0 1 1 3 12",
		"M3.5 4.5v5h5",
		"M12 7.5V12l3.5 2",
	],
	chart: ["M4.5 20.5v-5.5", "M12 20.5V4.5", "M19.5 20.5v-9"],
	tag: ["M3.5 3.5h6.4l10.6 10.6-6.4 6.4L3.5 9.9V3.5Z", "M7.2 7.3v.01"],
	// A shopping bag: body, then the handle as a half-circle arc over it. The
	// only glyph here that means "a sale happened" rather than "some traffic
	// did" — `tag` was the nearest existing fit and it is already spoken for by
	// the all-time visit count sitting next to it.
	sales: [
		"M4.5 8h15l-1.2 11a2 2 0 0 1-2 1.8H7.7a2 2 0 0 1-2-1.8L4.5 8Z",
		"M8.8 8V6.4a3.2 3.2 0 0 1 6.4 0V8",
	],
	// A head and shoulders — "your account", as distinct from `cog`, which is
	// how the product behaves rather than who is using it.
	user: [
		"M12 12.2a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8Z",
		"M4.8 20.4a7.8 7.8 0 0 1 14.4 0",
	],
	// Release notes: a document with three ruled lines, the top one short so it
	// reads as a heading over entries.
	changelog: [
		"M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z",
		"M14.6 3.2V7.4h4.2",
		"M8.5 12.5h7",
		"M8.5 16.5h4.5",
	],
	// A globe for the timezone row: outline, equator, and one meridian bowed to
	// read as a sphere rather than a target.
	globe: [
		"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
		"M3.2 12h17.6",
		"M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18Z",
	],
	// Speech bubble with a tail, for the feedback button in the top bar.
	feedback: [
		"M20.5 15.2a2 2 0 0 1-2 2h-9L5 20.8V6.2a2 2 0 0 1 2-2h11.5a2 2 0 0 1 2 2v9Z",
	],
	// The notification bell. The body closes as one outline — dome, shoulders,
	// then straight across the bottom — with the clapper as a separate arc, so
	// the unread dot can sit over the top right without colliding with a stroke.
	bell: [
		"M12 3.2a5.6 5.6 0 0 1 5.6 5.6c0 4 1 5.4 1.9 6.4a.8.8 0 0 1-.6 1.3H5.1a.8.8 0 0 1-.6-1.3c.9-1 1.9-2.4 1.9-6.4A5.6 5.6 0 0 1 12 3.2Z",
		"M10.2 19.4a2 2 0 0 0 3.6 0",
	],
	// A warning triangle. Same dot-and-stem construction as `help` — a stem
	// stopping short of a `v.1` dot — so the two read as one family when they
	// sit next to each other in the feedback picker.
	warning: [
		"M12 4.2 21.2 19.4a1.2 1.2 0 0 1-1 1.8H3.8a1.2 1.2 0 0 1-1-1.8L12 4.2Z",
		"M12 9.6v4.3",
		"M12 17.3v.1",
	],
	// A lit bulb — the other half of the feedback picker, where `warning` is
	// "something is broken" and this is "something could be better". Glass,
	// then two rungs for the base rather than a hatched screw thread, which
	// turns to mud at 14px.
	idea: [
		"M12 3.6a5.8 5.8 0 0 0-3.4 10.5c.6.45.9 1.1.9 1.8v.6h5v-.6c0-.7.3-1.35.9-1.8A5.8 5.8 0 0 0 12 3.6Z",
		"M9.5 18.7h5",
		"M10.7 21h2.6",
	],
	// A plain magnifier for the timezone search field.
	search: [
		"M11 18.2a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4Z",
		"M20.5 20.5l-4.4-4.4",
	],
	link: [
		"M10.4 13.6a3.8 3.8 0 0 0 5.4 0l2.8-2.8a3.8 3.8 0 1 0-5.4-5.4l-1.3 1.3",
		"M13.6 10.4a3.8 3.8 0 0 0-5.4 0l-2.8 2.8a3.8 3.8 0 1 0 5.4 5.4l1.3-1.3",
	],
	cog: ["M4 21v-6.5", "M4 10.5V3", "M12 21v-8.5", "M12 8.5V3", "M20 21v-4.5", "M20 12.5V3", "M1.5 14.5h5", "M9.5 8.5h5", "M17.5 16.5h5"],
	help: [
		"M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
		"M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.7.25-1 .8-1 1.5v.4",
		"M11.9 16.9v.1",
	],
	shield: ["M12 3.2 19.2 6v5.4c0 4.4-3 8-7.2 9.4-4.2-1.4-7.2-5-7.2-9.4V6L12 3.2Z"],
	sun: [
		"M16.2 12a4.2 4.2 0 1 1-8.4 0 4.2 4.2 0 0 1 8.4 0",
		"M12 2.5v2", "M12 19.5v2", "M2.5 12h2", "M19.5 12h2",
		"M5.3 5.3 6.7 6.7", "M17.3 17.3l1.4 1.4", "M18.7 5.3l-1.4 1.4", "M6.7 17.3l-1.4 1.4",
	],
	moon: ["M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a7 7 0 0 0 11.1 11.1Z"],
	menu: ["M3.5 6.5h17", "M3.5 12h17", "M3.5 17.5h17"],
	chevronLeft: ["M14.5 5.5 8 12l6.5 6.5"],
	chevronRight: ["M9.5 5.5 16 12l-6.5 6.5"],
	copy: [
		"M9.5 9.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9Z",
		"M6 15.5H4.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1V6",
	],
	external: ["M14 4h6v6", "M20 4l-8.5 8.5", "M18 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5"],
	logout: ["M9.5 20.5H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1h4.5", "M16 16.5l4.5-4.5L16 7.5", "M20.5 12h-11"],
	check: ["M4.5 12.5l5 5 10-11"],
	trendUp: ["M4 16.5 9.5 11l4 4 6.5-6.5", "M15 8.5h5v5"],
	trendDown: ["M4 8.5 9.5 14l4-4 6.5 6.5", "M15 15.5h5v-5"],
	trendFlat: ["M4.5 12h15"],
};

const paths = computed(() => icons[props.name] ?? []);
</script>
