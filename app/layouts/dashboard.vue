<template>
	<div class="dashLayout" :class="{ 'is-collapsed': collapsed, 'is-peel': peelReady }">
		<!-- Outside the peel whenever the peel is not driving it: as the ordinary
		     flex-sibling rail, and as the mobile drawer. -->
		<NuxtDashboardSidebar v-if="!peelActive" />

		<!-- Mobile only: closes the drawer on a tap outside it. Not focusable —
		     Escape and the drawer's own close button are the keyboard routes. -->
		<div
			v-if="drawerOpen"
			class="dashLayout-scrim"
			aria-hidden="true"
			@click="drawerOpen = false"
		/>


		<!-- The peel sheet. Where the browser supports it, the page lifts away
		     from its left edge as the pointer nears, revealing the nav underneath.
		     Where it does not, NuxtPeel renders its slot as a plain div and the
		     rail plus its toggle carry on as normal — which is why they stay.

		     The whole column is inside the sheet, top bar included. That is safe
		     here because the shell is a fixed height with `main` scrolling inside,
		     so the bar holds its place without `position: sticky`, which the peel
		     wrapper's `overflow: hidden` would otherwise break. -->
		<component :is="sheetTag" class="dashLayout-sheet" v-bind="sheetProps">
			<!-- The nav belongs inside the peel, not beside it. NuxtPeel tracks the
			     pointer on its own wrapper and retracts on pointerleave, so a nav
			     rendered as a sibling rolled the sheet shut the moment the pointer
			     moved onto it — which is why its links could not be clicked. In the
			     `under` slot the pointer never leaves the wrapper, the sheet stays
			     open, and the component's own pointer-events handling passes the
			     clicks through. -->
			<template #under>
				<NuxtDashboardSidebar v-if="peelActive" />
			</template>

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

					<!-- The title is hidden rather than deleted. It was the only h1 on
					     every tab, and a page with no h1 loses its place in the
					     heading outline that screen readers navigate by. Visually
					     the tab is already named by the active item in the sidebar. -->
					<h1 class="sr-only">{{ pageTitle }}</h1>

					<div class="dashBar-right">
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

				<!-- NuxtPage, not <slot />: app.vue renders a bare <NuxtLayout />, so
				     the layout mounts the page itself. A slot renders an empty main. -->
				<!-- data-lenis-prevent: Lenis is a marketing-site plugin that runs
				     app-wide and hijacks the wheel to smooth-scroll the window. In
				     peel mode the window cannot scroll — the shell is a fixed
				     height with `overflow: hidden` — so Lenis swallowed every
				     wheel event and the dashboard would not scroll at all, while
				     keyboard and programmatic scrolling still worked. This opts
				     the real scroll container out of Lenis, which is the escape
				     hatch _general.less already styles for. -->
				<main
					id="main"
					tabindex="-1"
					class="dashLayout-main"
					:data-lenis-prevent="peelReady ? '' : undefined"
				>
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
							<NuxtLink v-if="isAdmin" to="/dashboard/admin" class="btn btn--primary">
								Go to the admin panel
							</NuxtLink>
						</section>
					</div>

					<NuxtPage v-else />
				</main>
			</div>
		</component>
	</div>
</template>

<script setup lang="ts">
import { dashboardNav } from "~/composables/useDashboardNav";
import PeelSheet, { supportsHtmlInCanvas } from "~/components/peel.vue";

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

/**
 * Peel is a pointer gesture, so it needs a real pointer as well as the API.
 * Width is the wrong test — an iPad Pro in landscape is 1024px wide and has no
 * cursor at all, which would leave the nav hidden under an opaque sheet with no
 * way to reach it. `(hover: hover) and (pointer: fine)` asks the question that
 * actually matters, and is watched rather than read once so a tablet that gains
 * a trackpad picks it up.
 */
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

let pointerQuery: MediaQueryList | null = null;

const syncPeelReady = () => {
	peelReady.value = supportsHtmlInCanvas() && Boolean(pointerQuery?.matches);
};

onMounted(() => {
	pointerQuery = window.matchMedia(FINE_POINTER);
	pointerQuery.addEventListener("change", syncPeelReady);
	syncPeelReady();
});

onUnmounted(() => {
	pointerQuery?.removeEventListener("change", syncPeelReady);
});


// Peel only has something to reveal while the nav is tucked underneath the
// sheet. Once it is pinned open the sheet starts to its right, so the effect is
// switched off by zeroing the reveal rather than by unmounting the component —
// remounting would tear down and rebuild the page inside it.
const peelActive = computed(() => peelReady.value && collapsed.value);
const peelReveal = computed(() => (peelActive.value ? PEEL_REVEAL : 0));
const peelZone = computed(() => (peelActive.value ? PEEL_ZONE : 0));

/**
 * The sheet is only a NuxtPeel when peel is wanted; otherwise it is a plain div.
 *
 * Gating the class and the props is not enough. NuxtPeel runs its own
 * `supportsHtmlInCanvas()` check on mount and switches to the native path
 * whichever way this layout is configured — and that path absolutely positions
 * all three of its children, leaving the wrapper at zero height. On a touch
 * device that happens to have the flag, the dashboard then collapses and
 * nothing is reachable, including the menu button. Not mounting it is the only
 * reliable way to opt out.
 */
const sheetTag = computed(() => (peelReady.value ? PeelSheet : "div"));

const sheetProps = computed(() => (peelReady.value
	? {
			side: "left" as const,
			mode: "hover" as const,
			reveal: peelReveal.value,
			zone: peelZone.value,
			curl: 220,
			bow: 40,
			shade: 0.3,
			smoothing: 0.22,
		}
	: {}));

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
