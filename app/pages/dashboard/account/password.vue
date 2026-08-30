<template>
	<div class="auth">
		<div class="auth-card">
			<header class="auth-head">
				<span class="auth-mark" aria-hidden="true">CA</span>
				<p class="auth-preTitle">Champions Academy</p>
				<h1 class="auth-title">
					{{ done ? "Password changed" : "Change your password" }}
				</h1>
				<p class="auth-subTitle">
					{{ done
						? "Every other device has been signed out. This one stays signed in."
						: "Welcome back! Choose a new strong password and save it to proceed" }}
				</p>
			</header>

			<NuxtAlertBanner v-if="done" variant="success">
				Your password has been changed.
			</NuxtAlertBanner>

			<NuxtAlertBanner v-else-if="formError" variant="error">
				{{ formError }}
			</NuxtAlertBanner>

			<form v-if="!done" class="auth-form" novalidate @submit.prevent="submit">
				<NuxtAuthField
					v-model="currentPassword"
					label="Current password"
					type="password"
					autocomplete="current-password"
					:error="errors.currentPassword"
					:disabled="pending"
					required
				/>

				<NuxtAuthField
					v-model="newPassword"
					label="New password"
					type="password"
					autocomplete="new-password"
					:error="errors.newPassword"
					:disabled="pending"
					hint="At least 12 characters. Length beats symbols."
					required
				/>

				<button type="submit" class="btn btn--primary auth-submit" :disabled="pending">
					{{ pending ? "Saving…" : "Save new password" }}
				</button>
			</form>

			<footer class="auth-foot">
				<NuxtLink to="/dashboard/account" class="auth-switch">
					{{ done ? "Back to your account" : "Cancel" }}
				</NuxtLink>
				<p v-if="!done" class="auth-help">
					<NuxtLink to="/forgot-password">Forgotten your password?</NuxtLink>
				</p>
			</footer>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * The standalone change-password screen.
 *
 * A page of its own rather than a panel, and on the `auth` layout rather than
 * the dashboard one, so it arrives with no rail and no top bar. That is the
 * whole reason it exists: everything else in the account area is somewhere you
 * change one setting among many and carry on, and this is a credential — the
 * screen should have one thing on it and one way out.
 *
 * It is still a dashboard route (`/dashboard/**` is `no-store` in
 * nuxt.config.ts, and `auth` middleware bounces anyone signed out), so nothing
 * about being off the dashboard chrome puts it outside the dashboard's rules.
 *
 * Two fields, not three. There was a third — "confirm new password" — on the
 * Security tab's copy of this form, which this replaced rather than joined:
 * one credential with two places to change it is two places to keep in step.
 * Typing it twice guards against a typo, not against an attacker, and the
 * current-password field above is already the check that matters. See the note
 * in password.post.ts.
 */
definePageMeta({
	layout: "auth",
	middleware: "auth",
});

useSeoMeta({
	title: "Change your password",
	robots: "noindex, nofollow",
});

const currentPassword = ref("");
const newPassword = ref("");
const errors = ref<Record<string, string | undefined>>({});
const formError = ref<string | null>(null);
const pending = ref(false);
const done = ref(false);

async function submit() {
	if (pending.value) return;

	errors.value = {};
	formError.value = null;
	pending.value = true;

	try {
		await $fetch("/api/affiliate/password", {
			method: "POST",
			body: {
				currentPassword: currentPassword.value,
				newPassword: newPassword.value,
			},
		});

		done.value = true;
		currentPassword.value = "";
		newPassword.value = "";
	}
	catch (error) {
		const payload = (error as { data?: { statusMessage?: string; data?: { field?: string; message?: string } } })?.data;
		const field = payload?.data?.field;
		const message = payload?.data?.message ?? payload?.statusMessage ?? "Something went wrong. Please try again.";

		if (field) errors.value[field] = message;
		else formError.value = message;
	}
	finally {
		pending.value = false;
	}
}
</script>
