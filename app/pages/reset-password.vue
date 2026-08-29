<template>
	<div class="auth">
		<div class="auth-card">
			<header class="auth-head">
				<span class="auth-mark" aria-hidden="true">CA</span>
				<p class="auth-preTitle">Champions Academy</p>
				<h1 class="auth-title">
					{{ done ? "Password changed" : "Choose a new password" }}
				</h1>
				<p class="auth-subTitle">
					{{ done
						? "Every device has been signed out. Sign in with your new password."
						: "Pick something you don't use anywhere else." }}
				</p>
			</header>

			<NuxtAlertBanner v-if="done" variant="success">
				Your password has been changed.
			</NuxtAlertBanner>

			<NuxtAlertBanner v-else-if="!token" variant="error">
				This link is incomplete. Open the link from your email exactly as it was
				sent, or ask for a new one.
			</NuxtAlertBanner>

			<NuxtAlertBanner v-else-if="formError" variant="error">
				{{ formError }}
			</NuxtAlertBanner>

			<form v-if="token && !done" class="auth-form" novalidate @submit.prevent="submit">
				<NuxtAuthField
					v-model="password"
					label="New password"
					type="password"
					autocomplete="new-password"
					:error="errors.password"
					:disabled="pending"
					hint="At least 12 characters. Length beats symbols."
					required
				/>

				<NuxtAuthField
					v-model="passwordConfirm"
					label="Confirm new password"
					type="password"
					autocomplete="new-password"
					:error="errors.passwordConfirm"
					:disabled="pending"
					required
				/>

				<button type="submit" class="btn btn--primary auth-submit" :disabled="pending">
					{{ pending ? "Working…" : "Change my password" }}
				</button>
			</form>

			<footer class="auth-foot">
				<NuxtLink to="/login" class="auth-switch">
					{{ done ? "Sign in" : "Back to sign in" }}
				</NuxtLink>
				<p v-if="!token && !done" class="auth-help">
					<NuxtLink to="/forgot-password">Ask for a new link</NuxtLink>
				</p>
			</footer>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * Redeems a reset link.
 *
 * No `guest` middleware: the token in the URL is the credential, and the link
 * has to work whatever session the browser happens to be carrying. Completing
 * it destroys every session anyway, this one included.
 */
definePageMeta({ layout: "auth" });

useSeoMeta({
	title: "Choose a new password",
	robots: "noindex, nofollow",
});

const route = useRoute();
const router = useRouter();

/**
 * Read once, on load.
 *
 * Held in a ref rather than read from `route.query` at submit time because the
 * URL is rewritten below — the token is a live credential and does not belong
 * in the address bar, the back stack, or a screenshot for any longer than it
 * takes to read it.
 */
const token = ref(typeof route.query.token === "string" ? route.query.token : "");

onMounted(() => {
	if (token.value) router.replace({ query: {} });
});

const password = ref("");
const passwordConfirm = ref("");
const errors = ref<Record<string, string | undefined>>({});
const formError = ref<string | null>(null);
const pending = ref(false);
const done = ref(false);

async function submit() {
	if (pending.value) return;

	errors.value = {};
	formError.value = null;

	// Caught here so the mismatch appears under the field rather than as a
	// form-level failure, matching the redeem form.
	if (password.value !== passwordConfirm.value) {
		errors.value.passwordConfirm = "Passwords do not match";
		return;
	}

	pending.value = true;

	try {
		await $fetch("/api/auth/reset-password", {
			method: "POST",
			body: {
				token: token.value,
				password: password.value,
				passwordConfirm: passwordConfirm.value,
			},
		});

		done.value = true;
		password.value = "";
		passwordConfirm.value = "";
	}
	catch (error) {
		const data = (error as { data?: { statusMessage?: string; data?: { field?: string } } })?.data;
		const field = data?.data?.field;
		const message = data?.statusMessage ?? "Something went wrong. Please try again.";

		if (field && field !== "token") errors.value[field] = message;
		else formError.value = message;
	}
	finally {
		pending.value = false;
	}
}
</script>
