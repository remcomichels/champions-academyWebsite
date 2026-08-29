<template>
	<div class="auth">
		<div class="auth-card">
			<header class="auth-head">
				<span class="auth-mark" aria-hidden="true">CA</span>
				<p class="auth-preTitle">Champions Academy</p>
				<h1 class="auth-title">Reset your password</h1>
				<p class="auth-subTitle">
					{{ sent
						? "Check your inbox."
						: "Enter your email and we'll send you a link to choose a new password." }}
				</p>
			</header>

			<!-- Deliberately the same words whether or not that address has an
			     account. The server answers 204 either way; saying anything more
			     specific here would hand back what the API refuses to. -->
			<NuxtAlertBanner v-if="sent" variant="success">
				If an account exists for that address, we've sent a link. It works once and
				expires in an hour.
			</NuxtAlertBanner>

			<NuxtAlertBanner v-else-if="formError" variant="error">
				{{ formError }}
			</NuxtAlertBanner>

			<form v-if="!sent" class="auth-form" novalidate @submit.prevent="submit">
				<NuxtAuthField
					v-model="email"
					label="Email"
					type="email"
					inputmode="email"
					autocomplete="email"
					:error="fieldError"
					:disabled="pending"
					required
				/>

				<button type="submit" class="btn btn--primary auth-submit" :disabled="pending">
					{{ pending ? "Working…" : "Send the link" }}
				</button>
			</form>

			<footer class="auth-foot">
				<NuxtLink to="/login" class="auth-switch">Back to sign in</NuxtLink>
				<p v-if="sent" class="auth-help">
					Nothing arrived? Check spam, then try again in a few minutes.
				</p>
			</footer>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * Asks for a reset link.
 *
 * No `guest` middleware, unlike /login. Someone can want a reset while still
 * signed in somewhere — that is exactly what a person does when they think an
 * account is compromised — and bouncing them to the dashboard would send them
 * away from the one page that helps.
 */
definePageMeta({ layout: "auth" });

useSeoMeta({
	title: "Reset your password",
	robots: "noindex, nofollow",
});

const email = ref("");
const fieldError = ref<string | null>(null);
const formError = ref<string | null>(null);
const pending = ref(false);
const sent = ref(false);

async function submit() {
	if (pending.value) return;

	fieldError.value = null;
	formError.value = null;
	pending.value = true;

	try {
		await $fetch("/api/auth/forgot-password", {
			method: "POST",
			body: { email: email.value },
		});

		sent.value = true;
	}
	catch (error) {
		// Only validation and rate limiting can land here — the handler answers
		// 204 for every other outcome, including an address it has never seen.
		const data = (error as { data?: { statusMessage?: string; data?: { field?: string } } })?.data;

		if (data?.data?.field === "email") fieldError.value = data.statusMessage ?? "Check that address";
		else formError.value = data?.statusMessage ?? "Something went wrong. Please try again.";
	}
	finally {
		pending.value = false;
	}
}
</script>
