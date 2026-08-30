<template>
	<!-- Spans rather than divs: this sits inside a <label>, which only takes
	     phrasing content, and a <div> in there is invalid markup that browsers
	     recover from in their own ways. Every box here is laid out by CSS
	     anyway, so the element name was never doing the work. -->
	<span class="themeCard-rail">
		<i v-for="n in 4" :key="n" />
	</span>

	<span class="themeCard-main">
		<span class="themeCard-bar">
			<i v-for="n in 4" :key="n" />
		</span>
		<span v-for="n in 2" :key="n" class="themeCard-card">
			<i /><i />
		</span>
	</span>
</template>

<script setup lang="ts">
/**
 * A miniature of the dashboard chrome — rail, top bar, two cards.
 *
 * Deliberately not a screenshot. Every surface in here is painted with the same
 * custom properties the real dashboard uses, and the parent stamps
 * `data-theme` on the box around it — the tokens in dashboardTokens.less are
 * declared on a bare `[data-theme]` attribute selector rather than on `html`,
 * so they re-resolve inside any element carrying the attribute. That buys two
 * things: a dark preview renders correctly on a light page with no second
 * palette to keep in step, and changing a real token updates these previews
 * without anyone remembering that they exist.
 *
 * It carries no theme of its own and takes no props, because it is only ever
 * rendered inside a box that has already set one.
 *
 * Everything is proportional — percentages and one aspect-ratio on the frame —
 * so the same markup is a preview card here and would be a larger illustration
 * anywhere else without a second set of sizes.
 */
</script>
