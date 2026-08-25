<template>
	<aside
		class="dashNav"
		:class="{ 'is-collapsed': collapsed, 'is-open': drawerOpen }"
		:aria-label="'Dashboard sections'"
	>
		<div class="dashNav-head">
			<!-- The rail's own control, and the only thing showing once it is
			     collapsed. Deliberately not a chevron: the glyph is a picture of
			     a sidebar, so it reads the same whichever way the panel is about
			     to move, and nothing has to flip mid-animation.

			     On mobile the same button closes the drawer — see
			     `onCollapseClick`. -->
			<button
				type="button"
				class="dashNav-toggle"
				:aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
				:aria-expanded="!collapsed"
				:title="collapsed ? 'Expand sidebar' : undefined"
				@click="onCollapseClick"
			>
				<NuxtDashboardIcon name="sidebar" />
			</button>

			<!-- The wordmark is decorative, so the link carries the name itself. -->
			<NuxtLink to="/" class="dashNav-brand" aria-label="Champions Academy">
				<span class="dashNav-brandText">
					<span class="dashNav-logo" aria-hidden="true" />
				</span>
			</NuxtLink>
		</div>

		<nav class="dashNav-list">
			<NuxtLink
				v-for="item in items"
				:key="item.to"
				:to="item.to"
				class="dashNav-item"
				:class="{ 'is-active': isActive(item.to) }"
				:aria-current="isActive(item.to) ? 'page' : undefined"
				:title="collapsed ? item.label : undefined"
			>
				<NuxtDashboardIcon :name="item.icon" />
				<span class="dashNav-label">{{ item.label }}</span>
			</NuxtLink>
		</nav>

		<div class="dashNav-foot">
			<button
				type="button"
				class="dashNav-item dashNav-action"
				:title="collapsed ? nextThemeLabel : undefined"
				@click="toggle"
			>
				<NuxtDashboardIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
				<span class="dashNav-label">{{ nextThemeLabel }}</span>
			</button>

			<button
				type="button"
				class="dashNav-item dashNav-action"
				:title="collapsed ? 'Log out' : undefined"
				@click="logout"
			>
				<NuxtDashboardIcon name="logout" />
				<span class="dashNav-label">Log out</span>
			</button>
		</div>
	</aside>
</template>

<script setup lang="ts">
const { items, collapsed, toggleCollapsed, drawerOpen } = useDashboardNav();
const { theme, toggle } = useTheme();
const { logout } = useAuth();

const route = useRoute();

/**
 * Overview owns `/dashboard` exactly; every other entry owns its subtree.
 * `router-link-active` can't express that — it would light Overview up on every
 * page, since every dashboard path starts with `/dashboard`.
 */
const isActive = (to: string) =>
	to === "/dashboard" ? route.path === "/dashboard" : route.path.startsWith(to);

const nextThemeLabel = computed(() => (theme.value === "dark" ? "Light mode" : "Dark mode"));

// On mobile the same button closes the drawer; on desktop it collapses the rail.
const onCollapseClick = () => {
	if (drawerOpen.value) drawerOpen.value = false;
	else toggleCollapsed();
};

// A drawer left open over the new page after navigating is the classic mobile
// nav bug. Closing on path change costs one watcher.
watch(() => route.path, () => { drawerOpen.value = false; });
</script>
