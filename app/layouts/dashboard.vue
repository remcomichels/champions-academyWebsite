<template>
	<div class="dashLayout" :class="{ 'is-collapsed': collapsed }">
		<NuxtDashboardSidebar />

		<!-- Mobile only: closes the drawer on a tap outside it. Not focusable —
		     Escape and the drawer's own close button are the keyboard routes. -->
		<div
			v-if="drawerOpen"
			class="dashLayout-scrim"
			aria-hidden="true"
			@click="drawerOpen = false"
		/>

		<div class="dashLayout-body">
			<!-- NuxtPage, not <slot />: app.vue renders a bare <NuxtLayout />, so
			     the layout mounts the page itself. A slot renders an empty main. -->
			<main id="main" tabindex="-1" class="dashLayout-main">
				<!-- The row scrolls with the page rather than holding the top of
				     the screen. It is inside `main` for that reason; as a sibling
				     it sat outside the scrolling area and stayed put. -->
				<header class="dashBar">
					<button
						type="button"
						class="dashBar-menu"
						aria-label="Open navigation"
						@click="drawerOpen = true"
					>
						<NuxtDashboardIcon name="menu" />
					</button>

					<!-- The title is hidden rather than deleted. It was the only h1
					     on every tab, and a page with no h1 loses its place in the
					     heading outline that screen readers navigate by. Visually
					     the tab is already named by the active item in the sidebar. -->
					<h1 class="sr-only">{{ pageTitle }}</h1>

					<div class="dashBar-right">
						<!-- Before the bell, so the two things that change what the
						     page shows sit together and away from the avatar. -->
						<NuxtDashboardModeSwitch v-if="isAdmin" />

						<!-- Only mounted for accounts that actually have an affiliate:
						     the stream and inbox routes both require one. -->
						<NuxtDashboardInbox v-if="affiliate" />

						<NuxtLink
							v-if="affiliate"
							to="/dashboard/settings"
							class="dashBar-avatar"
							:aria-label="`Signed in as ${affiliate.displayName} — profile settings`"
						>
							<span aria-hidden="true">{{ initials }}</span>
						</NuxtLink>
					</div>
				</header>

				<!-- An admin-only login has no affiliate profile, so there are no
				     figures to show. Saying that plainly beats a generic failure,
				     which is what the owner would otherwise hit on every tab. It
				     lives here rather than in six pages, and Admin is exempt
				     because that is the one route such a login is for. -->
				<div v-if="showNoAffiliate" class="dashSection">
					<section class="dashPanel dashPanel--empty">
						<h2 class="dashPanel-title">No affiliate profile on this account</h2>
						<p class="dashPanel-note">
							This login isn't attached to an affiliate, so there are no referral
							figures to show. That's expected for an admin account.
						</p>
						<NuxtLink v-if="isAdmin" :to="ADMIN_HOME" class="btn btn--primary">
							Go to the admin panel
						</NuxtLink>
					</section>
				</div>

				<NuxtPage v-else />
			</main>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ADMIN_HOME, dashboardNav, isAdminRoute } from "~/composables/useDashboardNav";

const { isAdmin, affiliate, fetchMe } = useAuth();
const { collapsed, drawerOpen } = useDashboardNav();
const { theme } = useTheme();

// The auth middleware has already populated this, but a direct load of a
// nested route should not depend on that ordering.
await fetchMe();

const route = useRoute();

/**
 * `data-theme` goes on <html> so the page background covers an overscroll
 * bounce, which a wrapper div cannot. Set here rather than in app.vue: every
 * route using this layout is `no-store`, so the cookie-dependent markup is
 * never cached — doing this globally would make the marketing site's cached
 * HTML vary by cookie.
 *
 * Not a useSeoMeta case, so the CLAUDE.md rule about useHead doesn't apply —
 * that ban is about SEO tags, and app.vue already uses useHead for its font
 * preload for the same reason.
 */
useHead({ htmlAttrs: { "data-theme": theme } });

// Longest match wins, so /dashboard/analytics doesn't resolve to Overview.
const pageTitle = computed(() => {
	const match = [...dashboardNav]
		.sort((a, b) => b.to.length - a.to.length)
		.find(item => route.path === item.to || route.path.startsWith(`${item.to}/`));

	return match?.label ?? "Dashboard";
});

/**
 * Initials for the profile circle.
 *
 * Not a photo yet: `/api/auth/me` returns `avatarPath`, a Supabase Storage
 * path rather than a URL, and the bucket's base URL is server-side only — so
 * the browser cannot resolve it. When avatar upload ships, the endpoint should
 * return a resolved URL and this becomes the fallback for accounts without one.
 */
const initials = computed(() => {
	const name = affiliate.value?.displayName?.trim();
	if (!name) return "?";

	const parts = name.split(/\s+/).filter(Boolean);
	const first = parts[0]?.[0] ?? "";
	// Last word rather than second, so a middle name doesn't win over a surname.
	const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";

	return (first + last).toUpperCase();
});

// An admin-only login has nothing to show on an affiliate page, but every
// admin page is exactly what it is for — so the notice is suppressed across
// the whole admin section rather than on one route.
const showNoAffiliate = computed(() =>
	!affiliate.value && !isAdminRoute(route.path));

/**
 * Lock the page behind the mobile drawer. `_general.less` already defines
 * `html.stop-scroll` for the marketing site's mobile menu, so this reuses that
 * rather than introducing a second scroll-lock mechanism.
 *
 * Cleared on unmount as well: navigating away with the drawer open would
 * otherwise leave the marketing site unscrollable.
 */
if (import.meta.client) {
	watch(drawerOpen, (open) => {
		document.documentElement.classList.toggle("stop-scroll", open);
	});

	onUnmounted(() => {
		document.documentElement.classList.remove("stop-scroll");
	});
}
</script>
