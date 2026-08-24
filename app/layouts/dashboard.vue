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
			<header class="dashBar">
				<button
					type="button"
					class="dashBar-menu"
					aria-label="Open navigation"
					@click="drawerOpen = true"
				>
					<NuxtDashboardIcon name="menu" />
				</button>

				<h1 class="dashBar-title">{{ pageTitle }}</h1>

				<div class="dashBar-right">
					<!-- Only mounted for accounts that actually have an affiliate:
					     the stream and inbox routes both require one. -->
					<NuxtDashboardInbox v-if="affiliate" />
					<span v-if="affiliate" class="dashBar-who">{{ affiliate.displayName }}</span>
				</div>
			</header>

			<!-- The peel sheet. When the browser supports it, the page lifts away
			     from its left edge as the pointer nears it, revealing the nav
			     underneath — so the sidebar opens by peeling rather than by
			     clicking. Where it is unsupported NuxtPeel renders its slot as a
			     plain div, which is why the rail and its toggle stay: they are
			     the only way in for everyone else.

			     The top bar deliberately sits outside the sheet. NuxtPeel wraps
			     its content in `overflow: hidden`, which would break the bar's
			     `position: sticky`. -->
			<NuxtPeel
				class="dashLayout-sheet"
				side="left"
				mode="hover"
				:reveal="peelReveal"
				:zone="peelZone"
				:curl="220"
				:bow="40"
				:shade="0.3"
				:smoothing="0.22"
			>
				<!-- NuxtPage, not <slot />: app.vue renders a bare <NuxtLayout />,
				     so the layout mounts the page itself. A slot here renders an
				     empty main. -->
				<main id="main" tabindex="-1" class="dashLayout-main">
					<!-- An admin-only login has no affiliate profile, so there are
					     no figures to show. Saying that plainly beats a generic
					     failure, which is what the owner would otherwise hit on
					     every tab. It lives in the layout rather than in six
					     pages, and Admin is exempt because that is the one route
					     such a login is for. -->
					<div v-if="showNoAffiliate" class="dashSection">
						<section class="dashPanel dashPanel--empty">
							<h2 class="dashPanel-title">No affiliate profile on this account</h2>
							<p class="dashPanel-note">
								This login isn't attached to an affiliate, so there are no referral
								figures to show. That's expected for an admin account.
							</p>
							<NuxtLink v-if="isAdmin" to="/dashboard/admin" class="btn btn--primary">
								Go to the admin panel
							</NuxtLink>
						</section>
					</div>

					<NuxtPage v-else />
				</main>
			</NuxtPeel>
		</div>
	</div>
</template>

<script setup lang="ts">
import { dashboardNav } from "~/composables/useDashboardNav";
import { supportsHtmlInCanvas } from "~/components/peel.vue";

// Matches the expanded sidebar width in dashboard.less. In CSS pixels,
// because NuxtPeel measures in them — this is one of the few places the vw
// ladder cannot reach, since the value crosses into WebGL.
const PEEL_REVEAL = 240;
/** How near the left edge the pointer has to get before the sheet lifts. */
const PEEL_ZONE = 48;

const { isAdmin, affiliate, fetchMe } = useAuth();
const { collapsed, drawerOpen } = useDashboardNav();
const { theme } = useTheme();

/**
 * Peel-to-open, when the browser can do it.
 *
 * NuxtPeel captures the sheet through `canvas.drawElementImage` on a
 * `layoutsubtree` canvas — the experimental HTML-in-Canvas API, which today is
 * Chrome-only and behind a flag. Everywhere else this stays false and the
 * dashboard behaves exactly as it does without the effect.
 *
 * Resolved after mount because it probes a DOM API, so it is false during SSR
 * and for the first client frame.
 */
const peelReady = ref(false);

onMounted(() => { peelReady.value = supportsHtmlInCanvas(); });

// Peel only has something to reveal while the nav is tucked underneath the
// sheet. Once it is pinned open the sheet starts to its right, so the effect is
// switched off by zeroing the reveal rather than by unmounting the component —
// remounting would tear down and rebuild the page inside it.
const peelActive = computed(() => peelReady.value && collapsed.value);
const peelReveal = computed(() => (peelActive.value ? PEEL_REVEAL : 0));
const peelZone = computed(() => (peelActive.value ? PEEL_ZONE : 0));

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

const showNoAffiliate = computed(() =>
	!affiliate.value && route.path !== "/dashboard/admin");

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
