<template>
	<aside
		class="dashNav"
		:class="{ 'is-open': drawerOpen, 'is-static': accountMode }"
		:aria-label="accountMode ? 'Account settings sections' : 'Dashboard sections'"
	>
		<!-- Mobile only, and hidden on desktop by `display: none`.

		     The desktop rail has no control of its own any more — there is no
		     pinned state left to toggle, so a button that opened one would have
		     nothing to do. The drawer still needs a way out that is not "tap the
		     scrim and hope", so the same element survives at drawer width. -->
		<button
			type="button"
			class="dashNav-close"
			aria-label="Close navigation"
			@click="drawerOpen = false"
		>
			<NuxtDashboardIcon name="close" class="dashNav-glyph" />
		</button>

		<!-- The account rail replaces the affiliate one rather than nesting
		     under it, so it has to carry its own way out. Above the rule and
		     outside the list: it is not one of the sections, it is how you stop
		     being in them. -->
		<NuxtLink v-if="accountMode" to="/dashboard" class="dashNav-back">
			<NuxtDashboardIcon name="arrowLeft" class="dashNav-glyph" />
			<span class="dashNav-label">Back to dashboard</span>
		</NuxtLink>

		<nav class="dashNav-list">
			<template v-for="item in items" :key="item.to">
				<!-- Presentational: the rule is a grouping cue for the eye, and
				     announcing a separator between two links adds nothing for a
				     screen reader that is already reading them as a list. -->
				<hr v-if="item.group" class="dashNav-rule" aria-hidden="true" >

				<!-- Unlike the rule, this one is read out: it is the only thing
				     saying what the entries under it have in common. -->
				<p v-if="item.heading" class="dashNav-heading">{{ item.heading }}</p>

				<NuxtLink
					:to="item.to"
					class="dashNav-item"
					:class="{ 'is-active': isActive(item.to) }"
					:aria-current="isActive(item.to) ? 'page' : undefined"
				>
					<NuxtDashboardIcon v-if="item.icon" :name="item.icon" class="dashNav-glyph" />
					<span class="dashNav-label">{{ item.label }}</span>
				</NuxtLink>
			</template>
		</nav>

	</aside>
</template>

<script setup lang="ts">
import { matchNavItem } from "~/composables/useDashboardNav";

/**
 * The rail down the left of the dashboard.
 *
 * One width at rest — the top bar's height, so the two meet as a square in the
 * corner — and it peeks open under the pointer. There is no pinned state: a
 * rail that can be latched open has to push the page column sideways to make
 * room for itself, and that shift was worth neither the code nor the cookie
 * that remembered it. Peeking floats over the content instead, so nothing in
 * the page moves at all.
 *
 * The labels are in the DOM at rest, merely transparent, so a screen reader
 * reads a full set of names off a rail that looks like icons. Keyboard users
 * get the real thing: the peek is on `:focus-within` as well as `:hover`.
 *
 * The account area is the exception, and `is-static` is what makes it one: in
 * there the rail is open at its full width and stays that way. Peeking is a
 * trade — a narrow rail in exchange for having to point at it — and it is the
 * wrong one for a set of tabs, which have to be readable to be chosen between.
 */
const { items, drawerOpen, accountMode } = useDashboardNav();

const route = useRoute();

/**
 * Longest match wins, within the set currently drawn.
 *
 * `router-link-active` can't express this and neither can a bare `startsWith`:
 * every dashboard path begins with `/dashboard`, so Overview would light up
 * everywhere, and `/dashboard/account` would light Preferences up while you are
 * reading Security.
 */
const isActive = (to: string) => matchNavItem(route.path, items.value)?.to === to;

// A drawer left open over the new page after navigating is the classic mobile
// nav bug. Closing on path change costs one watcher.
watch(() => route.path, () => { drawerOpen.value = false; });
</script>
