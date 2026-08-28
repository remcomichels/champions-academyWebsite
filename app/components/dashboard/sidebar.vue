<template>
	<aside
		class="dashNav"
		:class="{ 'is-open': drawerOpen }"
		:aria-label="'Dashboard sections'"
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

		<nav class="dashNav-list">
			<template v-for="item in items" :key="item.to">
				<!-- Presentational: the rule is a grouping cue for the eye, and
				     announcing a separator between two links adds nothing for a
				     screen reader that is already reading them as a list. -->
				<hr v-if="item.group" class="dashNav-rule" aria-hidden="true" >

				<NuxtLink
					:to="item.to"
					class="dashNav-item"
					:class="{ 'is-active': isActive(item.to) }"
					:aria-current="isActive(item.to) ? 'page' : undefined"
				>
					<NuxtDashboardIcon :name="item.icon" class="dashNav-glyph" />
					<span class="dashNav-label">{{ item.label }}</span>
				</NuxtLink>
			</template>
		</nav>

	</aside>
</template>

<script setup lang="ts">
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
 */
const { items, drawerOpen } = useDashboardNav();

const route = useRoute();

/**
 * Overview owns `/dashboard` exactly; every other entry owns its subtree.
 * `router-link-active` can't express that — it would light Overview up on every
 * page, since every dashboard path starts with `/dashboard`.
 */
const isActive = (to: string) =>
	to === "/dashboard" ? route.path === "/dashboard" : route.path.startsWith(to);

// A drawer left open over the new page after navigating is the classic mobile
// nav bug. Closing on path change costs one watcher.
watch(() => route.path, () => { drawerOpen.value = false; });
</script>
