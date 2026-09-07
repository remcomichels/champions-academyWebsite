<script setup lang="ts">
// The upright Plus Jakarta Sans face, preloaded. It is referenced from
// fonts.css, so without this the browser only discovers it after that
// stylesheet has downloaded and parsed — the font request starts a full
// round-trip late, and body copy renders in the fallback until it lands.
// The `?url` import resolves to the hashed build filename, so the hint keeps
// pointing at the real file across deploys.
//
// crossorigin is required even though this is same-origin: fonts are always
// fetched in CORS mode, and a preload without it is treated as a separate
// request, downloading the file twice.
//
// Only the upright face is hinted. The italic is used by whatever rich text
// happens to contain it, so preloading it site-wide would pull 36KB on pages
// that never render an <em>.
import fontUpright from "~/assets/fonts/PlusJakartaSans-Variable.woff2?url";

// Not an SEO tag — useSeoMeta has no link support, and resource hints are
// outside what the useHead ban in CLAUDE.md covers.
useHead({
	link: [
		{
			rel: "preload",
			as: "font",
			type: "font/woff2",
			href: fontUpright,
			crossorigin: "",
		},
	],
});

// The intro overlay and the page-transition cover are marketing-site furniture.
// /login and /dashboard are app surfaces: the intro is driven by the marketing
// hero, so on a route without one it would black the screen out and never
// resolve. Marked complete up front there so gated reveal animations still run.
const route = useRoute()
// `forgot-password` joins the list: it renders the same glass pane and card as
// /login, and the marketing intro sweeping over it on the way in made a
// password reset look like a landing page. The two remaining auth screens —
// reset-password and confirm-email — are still outside this and still get the
// overlay; they are next.
const isAppRoute = computed(() => /^\/(?:[a-z]{2}\/)?(?:login|forgot-password|dashboard)\b/.test(route.path))

// Initialize before any child component mounts so reveal animations wait for the intro.
// Persists as `true` across SPA navigations so subsequent pages animate immediately.
const introComplete = useState('introComplete', () => false)
if (isAppRoute.value) introComplete.value = true

// Intro plays once on first load (sets introComplete); page transitions run on
// every route change (toggles pageTransitioning). Both read their overlay from
// the markup below.
useIntro()
usePageTransition()

// Destination name shown in the transition overlay; usePageTransition sets it
// from the outgoing route before the cover animation runs.
const pageTransitionLabel = useState<string>('pageTransitionLabel', () => '')

// Single global inview instance: reveals every [data-scroll-inview] section
// once the intro/transition is done. Blocks only need the attribute + CSS.
const { initInview } = useInview()
onMounted(() => initInview())
</script>

<template>
	<!-- Accessibility: skip-to-content link (visible on focus) + screen-reader route announcer -->
	<a class="skip-link" href="#main">Skip to content</a>
	<NuxtRouteAnnouncer />
	<!-- First-load intro overlay — server-rendered so it covers from first paint -->
	<div v-if="!isAppRoute" class="intro" />
	<!-- Route-change transition overlay — parked offscreen until a navigation runs.
	     aria-hidden: NuxtRouteAnnouncer already announces the destination. -->
	<div v-if="!isAppRoute" class="pageTransition" aria-hidden="true">
		<span class="pageTransition-label">{{ pageTransitionLabel }}</span>
	</div>
	<NuxtLayout />
</template>
