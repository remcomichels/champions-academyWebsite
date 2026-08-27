<template>
	<div class="dashLayout" :class="{ 'is-collapsed': collapsed, 'has-alertBar': vipLinkPending }">
		<!-- Across the very top of the viewport, over the rail rather than
		     beside it. This is an account-level warning, not an Overview one —
		     sales are going uncredited on every page, so it follows the
		     affiliate around instead of living in one page's flow where it was
		     being scrolled past. `status`, not `alert`: it is true for as long
		     as the setup is pending, so interrupting a screen reader with it on
		     every navigation would be noise. -->
		<div v-if="vipLinkPending" class="alertBar" role="status">
			<p class="alertBar-text">
				<strong>Your VIP link is still being set up.</strong>
				Until it's ready, VIP buttons on the site show the standard link and
				those sales won't be credited to you.
			</p>
		</div>

		<!-- A sibling of `main`, not a child of it.
		
		     The bar is fixed across the top of the viewport and has to paint above
		     the rail. `.dashLayout-main` sets `z-index: 1`, which opens a stacking
		     context — anything inside it is confined to that layer however high its
		     own z-index goes, so from in there the bar could never clear a rail at
		     50. Out here it can. It is also the more honest markup: a banner is not
		     part of the main content it sits above. -->
		<header class="dashBar">
			<button
				type="button"
				class="dashBar-menu"
				aria-label="Open navigation"
				@click="drawerOpen = true"
			>
				<NuxtDashboardIcon name="menu" />
			</button>

			<!-- Both marks render and CSS picks one by `data-theme`, rather than
			     binding `:src` to the resolved theme. The pre-paint script in
			     <head> can change that attribute before hydration, so a bound src
			     would serve the wrong mark for the first frame to anyone on
			     `system` + light — the very flash that script exists to prevent,
			     moved onto the logo. An attribute-driven swap has no such gap. -->
			<NuxtLink :to="AFFILIATE_HOME" class="dashBar-brand" aria-label="Champions Academy — Overview">
				<NuxtAppImage
					src="/images/logo.svg"
					alt=""
					class="dashBar-logo dashBar-logo--onDark"
					:width="103"
					:height="29"
				/>
				<NuxtAppImage
					src="/images/logo-light.svg"
					alt=""
					class="dashBar-logo dashBar-logo--onLight"
					:width="103"
					:height="29"
				/>
			</NuxtLink>

			<!-- The title is hidden rather than deleted. It was the only h1
			     on every tab, and a page with no h1 loses its place in the
			     heading outline that screen readers navigate by. Visually
			     the tab is already named by the active item in the sidebar. -->
			<h1 class="sr-only">{{ pageTitle }}</h1>

			<div class="dashBar-right">
				<!-- Before the bell, so the two things that change what the
				     page shows sit together and away from the avatar. -->
				<NuxtDashboardModeSwitch v-if="isAdmin" />

				<NuxtDashboardFeedback v-if="affiliate && !viewingAs" />

				<NuxtLink to="/dashboard/support" class="dashBar-action" aria-label="Help and FAQ">
					<NuxtDashboardIcon name="help" />
				</NuxtLink>

				<!-- Only mounted for accounts that actually have an affiliate:
				     the stream and inbox routes both require one.

				     Hidden while viewing someone else. It opens an SSE stream
				     and marks notifications read, which is a write — so it
				     would 403 against the read-only rule on every open, and
				     an admin has no business clearing another affiliate's
				     unread badge by looking at it. -->
				<NuxtDashboardInbox v-if="affiliate && !viewingAs" />

				<NuxtDashboardProfileMenu v-if="affiliate" />
			</div>
		</header>

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
				<!-- Persistent, above everything, and impossible to dismiss without
				     leaving. A session left in this state is one where an admin
				     later reads someone else's figures as their own. -->
				<div v-if="viewingAs" class="viewingAs">
					<span class="viewingAs-text">
						Viewing <strong>{{ viewingAs.displayName }}</strong>
						<span class="viewingAs-slug">?r={{ viewingAs.slug }}</span>
						<span v-if="viewingAs.status !== 'active'" class="viewingAs-flag">Revoked</span>
						— read only.
					</span>
					<button type="button" class="viewingAs-exit" @click="stopViewingAs">
						Stop viewing
					</button>
				</div>


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
import { ADMIN_HOME, AFFILIATE_HOME, dashboardNav, isAdminRoute } from "~/composables/useDashboardNav";

const { isAdmin, affiliate, viewingAs, stopViewingAs, fetchMe } = useAuth();
const { collapsed, drawerOpen } = useDashboardNav();
const { resolved: theme } = useTheme();

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
useHead({
	htmlAttrs: { "data-theme": theme },

	/**
	 * Corrects `data-theme` before the first paint, for the one case SSR cannot
	 * get right on its own: `system`.
	 *
	 * The server has no way to read `prefers-color-scheme`, so it renders the
	 * dark guess. This runs during head parsing — synchronously, before the body
	 * is painted and well before hydration — and swaps the attribute if the OS
	 * actually asks for light. Without it a light-mode visitor would see the
	 * page render dark and snap over a moment later.
	 *
	 * Reads the cookie directly rather than being handed the value, because it
	 * has to run before any of the app's own JavaScript exists. Wrapped in
	 * try/catch: a browser with cookies walled off should render the SSR default,
	 * not a blank page.
	 */
	script: [{
		tagPosition: "head",
		innerHTML: `(function(){try{`
			+ `var m=document.cookie.match(/(?:^|; )ca_theme=([^;]*)/);`
			+ `var c=m?decodeURIComponent(m[1]):'system';`
			+ `if(c!=='dark'&&c!=='light'&&c!=='classic')c='system';`
			+ `var t=c==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):c;`
			+ `document.documentElement.setAttribute('data-theme',t);`
			+ `}catch(e){}})();`,
	}],
});

// Longest match wins, so /dashboard/analytics doesn't resolve to Overview.
const pageTitle = computed(() => {
	const match = [...dashboardNav]
		.sort((a, b) => b.to.length - a.to.length)
		.find(item => route.path === item.to || route.path.startsWith(`${item.to}/`));

	return match?.label ?? "Dashboard";
});


// An admin-only login has nothing to show on an affiliate page, but every
// admin page is exactly what it is for — so the notice is suppressed across
// the whole admin section rather than on one route.
const showNoAffiliate = computed(() =>
	!affiliate.value && !isAdminRoute(route.path));

/**
 * The VIP-link warning bar.
 *
 * Read here rather than on Overview because it is an account-level fact: while
 * it is true the affiliate's VIP buttons fall back to the site default on every
 * page, so the bar follows them instead of appearing on one.
 *
 * No extra request. `useAffiliateSummary` is a `useAsyncData` on a fixed key,
 * so this shares the one entry with whichever page also asks for it — and it is
 * gated on having an affiliate profile for the same reason `showNoAffiliate`
 * is, since an admin-only login can only ever get a 403 from that endpoint.
 */
const { data: affiliateSummary } = await useAffiliateSummary({ immediate: !!affiliate.value });

const vipLinkPending = computed(() => affiliateSummary.value?.vipLinkPending === true);

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
