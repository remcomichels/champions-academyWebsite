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
	home: ["M3 10.6 12 3l9 7.6", "M5.5 9.6V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.6"],
	chart: ["M4.5 20.5v-5.5", "M12 20.5V4.5", "M19.5 20.5v-9"],
	tag: ["M3.5 3.5h6.4l10.6 10.6-6.4 6.4L3.5 9.9V3.5Z", "M7.2 7.3v.01"],
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
	bell: ["M18 8.5a6 6 0 1 0-12 0c0 4.8-2 5.9-2 5.9h16s-2-1.1-2-5.9Z", "M10.3 19.8a2 2 0 0 0 3.4 0"],
	sun: [
		"M16.2 12a4.2 4.2 0 1 1-8.4 0 4.2 4.2 0 0 1 8.4 0",
		"M12 2.5v2", "M12 19.5v2", "M2.5 12h2", "M19.5 12h2",
		"M5.3 5.3 6.7 6.7", "M17.3 17.3l1.4 1.4", "M18.7 5.3l-1.4 1.4", "M6.7 17.3l-1.4 1.4",
	],
	moon: ["M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a7 7 0 0 0 11.1 11.1Z"],
	menu: ["M3.5 6.5h17", "M3.5 12h17", "M3.5 17.5h17"],
	chevronLeft: ["M14.5 5.5 8 12l6.5 6.5"],
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
