<template>
	<div v-if="mustAsk" class="consent" role="dialog" aria-live="polite" aria-label="Analytics cookies">
		<div class="consent-inner">
			<p class="consent-text">
				We'd like to use analytics cookies to see how people find and use the
				site. They're optional — decline and nothing is set.
				<NuxtLink to="/privacy" class="consent-link">Privacy policy</NuxtLink>
			</p>

			<div class="consent-actions">
				<button type="button" class="consent-button" @click="decline">Decline</button>
				<button type="button" class="consent-button is-primary" @click="accept">Accept</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * Shown only to visitors in the EEA, UK and Switzerland, where consent is
 * required before an analytics cookie may be set. Everywhere else analytics
 * runs by default and this never appears.
 *
 * Decline is a real decline: posthog-js is never initialised, so no cookie is
 * written and no event is sent.
 *
 * This component must be mounted inside <ClientOnly> by its parent — see
 * layouts/default.vue. A ClientOnly *inside* here would skip the render but
 * still run this setup during SSR, which puts consent state into the payload
 * and makes the page vary by cookie.
 */
const { mustAsk, accept, decline } = useConsent();
</script>
