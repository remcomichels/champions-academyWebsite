<template>
	<div class="authSplit">
		<!-- The dashboard, blurred by the glass above it. Full width here: there is
		     no second pane to leave a channel to, so nothing shows through sharp. -->
		<div class="authSplit-ghost" aria-hidden="true">
			<NuxtAuthGhost />
		</div>

		<section class="authSplit-form">
			<div class="authPane">
				<div class="authPane-glass">
					<div class="auth">
						<div class="auth-card">
							<header class="auth-head">
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
									label="Email address"
									type="email"
									inputmode="email"
									autocomplete="email"
									placeholder="you@example.com"
									:error="fieldError"
									:disabled="pending"
									required
								/>

								<button type="submit" class="btn btn--primary auth-submit" :disabled="pending">
									{{ pending ? "Working…" : "Send the link" }}
								</button>
							</form>

							<!-- Only while the form is up. Once the link is sent there is no
							     first option left for this to be the alternative to, and an
							     "or" over a lone back-link reads as a missing choice. -->
							<div v-if="!sent" class="auth-or" role="presentation">
								<span>or</span>
							</div>

							<NuxtLink to="/login" class="auth-alt">Back to sign in</NuxtLink>

							<p v-if="sent" class="auth-help">
								Nothing arrived? Check spam, then try again in a few minutes.
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
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
