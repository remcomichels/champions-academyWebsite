<template>
	<button type="button" class="footer-cookieSettings" @click="reopen">
		Cookie settings
	</button>
</template>

<script setup lang="ts">
/**
 * Reopens the analytics choice. Must be mounted inside <ClientOnly>.
 *
 * It lives in its own component so that `useConsent()` — which reads a cookie —
 * is never called from a parent that renders on the server. Calling it in
 * footer.vue's setup put consent state into the SSR payload and made the page
 * vary by cookie, which would stop it being cacheable. ClientOnly skips the
 * render, not the setup, so the boundary has to sit above the composable.
 */
const { reopen } = useConsent();
</script>
