<template>
	<div class="auth">
		<div class="auth-card">
			<header class="auth-head">
				<span class="auth-mark" aria-hidden="true">CA</span>
				<p class="auth-preTitle">Champions Academy</p>
				<h1 class="auth-title">
					{{ mode === "login" ? "Affiliate sign in" : "Set up your account" }}
				</h1>
				<p class="auth-subTitle">
					{{ mode === "login"
						? "Use the email and password you set up with your invite code."
						: "Enter the one-time code you were given, then choose a password." }}
				</p>
			</header>

			<NuxtAlertBanner v-if="formError" variant="error">
				{{ formError }}
			</NuxtAlertBanner>

			<form class="auth-form" novalidate @submit.prevent="submit">
				<NuxtAuthField
					v-if="mode === 'redeem'"
					v-model="form.code"
					label="Invite code"
					placeholder="CA-XXXX-XXXX-XXXX"
					autocomplete="one-time-code"
					:error="errors.code"
					hint="Dashes and capitals don't matter."
					required
				/>

				<NuxtAuthField
					v-model="form.email"
					label="Email"
					type="email"
					inputmode="email"
					autocomplete="email"
					:error="errors.email"
					required
				/>

				<NuxtAuthField
					v-if="mode === 'redeem'"
					v-model="form.emailConfirm"
					label="Confirm email"
					type="email"
					inputmode="email"
					autocomplete="email"
					:error="errors.emailConfirm"
					hint="This is how you sign in, and where a reset link would be sent."
					required
				/>

				<NuxtAuthField
					v-model="form.password"
					label="Password"
					type="password"
					:autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
					:error="errors.password"
					:hint="mode === 'redeem' ? 'At least 12 characters. Length beats symbols.' : null"
					required
				/>

				<NuxtAuthField
					v-if="mode === 'redeem'"
					v-model="form.passwordConfirm"
					label="Confirm password"
					type="password"
					autocomplete="new-password"
					:error="errors.passwordConfirm"
					required
				/>

				<button type="submit" class="btn btn--primary auth-submit" :disabled="pending">
					{{ pending
						? "Working…"
						: mode === "login" ? "Sign in" : "Create account" }}
				</button>
			</form>

			<footer class="auth-foot">
				<button type="button" class="auth-switch" @click="setMode(mode === 'login' ? 'redeem' : 'login')">
					{{ mode === "login"
						? "I have an invite code"
						: "I already have an account" }}
				</button>
				<p v-if="mode === 'login'" class="auth-help">
					<NuxtLink to="/forgot-password">Forgot your password?</NuxtLink>
				</p>
			</footer>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useLogin } from "~/assets/js/components/login";

definePageMeta({
	layout: "auth",
	middleware: "guest",
});

useSeoMeta({
	title: "Affiliate sign in",
	robots: "noindex, nofollow",
});

const { mode, setMode, form, errors, formError, pending, submit } = useLogin();
</script>
