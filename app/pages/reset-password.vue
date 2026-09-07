<template>
	<div class="authSplit">
		<!-- The dashboard, blurred by the glass above it. Full width, as on
		     /forgot-password: there is no second pane to leave a channel to. -->
		<div class="authSplit-ghost" aria-hidden="true">
			<NuxtAuthGhost />
		</div>

		<section class="authSplit-form">
			<div class="authPane">
				<div class="authPane-glass">
					<div class="auth">
						<div class="auth-card">
							<!-- `aria-live` sits here permanently rather than appearing with
							     the confirmation. Submitting removes the form, and with it
							     the button that had focus, so nothing would otherwise tell a
							     screen reader the password changed — and a live region added
							     at the same moment as its content is not reliably
							     announced. -->
							<header class="auth-head" aria-live="polite">
								<!-- Both outcomes get the same shape: a mark, a heading and a
								     line of explanation. A broken link is as final as a
								     changed password — neither is something a banner over a
								     form should be reporting, because in both cases there is
								     no form left underneath it. -->
								<span
									v-if="state !== 'form'"
									class="auth-check"
									:class="{ 'auth-check--bad': state === 'broken' }"
									aria-hidden="true"
								>
									<NuxtDashboardIcon :name="state === 'done' ? 'check' : 'close'" />
								</span>

								<h1 class="auth-title">{{ heading }}</h1>
								<p class="auth-subTitle">{{ standfirst }}</p>
							</header>

							<NuxtAlertBanner v-if="formError" variant="error">
								{{ formError }}
							</NuxtAlertBanner>

							<form v-if="state === 'form'" class="auth-form" novalidate @submit.prevent="submit">
								<NuxtAuthField
									v-model="password"
									label="New password"
									type="password"
									autocomplete="new-password"
									placeholder="At least 12 characters"
									:error="errors.password"
									:disabled="pending"
									required
								/>

								<NuxtAuthField
									v-model="passwordConfirm"
									label="Confirm new password"
									type="password"
									autocomplete="new-password"
									placeholder="Repeat your password"
									:error="errors.passwordConfirm"
									:disabled="pending"
									required
								/>

								<button type="submit" class="btn btn--primary auth-submit" :disabled="pending">
									{{ pending ? "Working…" : "Change my password" }}
								</button>
							</form>

							<!-- Only while the form is up. Once the password is changed — or
							     if the link arrived broken — there is no first option left
							     for the back-link to be the alternative to, and an "or" over
							     a lone button reads as a missing choice. -->
							<div v-if="state === 'form'" class="auth-or" role="presentation">
								<span>or</span>
							</div>

							<NuxtLink to="/login" class="auth-alt">
								{{ state === "done" ? "Sign in" : "Back to sign in" }}
							</NuxtLink>

							<p v-if="state === 'broken'" class="auth-help">
								<NuxtLink to="/forgot-password">Ask for a new link</NuxtLink>
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

/**
 * Dev-only shortcut to the finished screen.
 *
 * `done` is otherwise only reachable by completing a real reset, which needs a
 * live token and burns it — so the one state nobody can open on purpose was the
 * one hardest to look at. `/reset-password?preview=done` opens it.
 *
 * The broken state needs no flag: it is what `/reset-password` with no token
 * already is.
 *
 * `import.meta.dev` is a compile-time constant, so this and everything it
 * guards are eliminated from the production bundle.
 */
if (import.meta.dev && route.query.preview === "done") done.value = true;

/**
 * Three outcomes, and they are mutually exclusive: the form, the confirmation,
 * and a link that arrived without its token. Named here rather than spelled out
 * as nested ternaries in the template, which is where the last two used to
 * disagree about whether `done` or `!token` won.
 */
const state = computed<"form" | "done" | "broken">(() => {
	if (done.value) return "done";
	return token.value ? "form" : "broken";
});

const heading = computed(() => ({
	form: "Choose a new password",
	done: "Password changed",
	broken: "Link incomplete",
}[state.value]));

const standfirst = computed(() => ({
	form: "Pick something you don't use anywhere else.",
	done: "Every device has been signed out. Sign in with your new password.",
	broken: "Open the link from your email exactly as it was sent, or ask for a new one.",
}[state.value]));

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

		if (field === "token") {
			// The token is in the link, not in the form, so the validator's own
			// words — "token must be at least 20 characters" — describe a field
			// nobody filled in and cannot fix. An expired or spent token is a
			// different branch and arrives with no `field` and a sentence of its
			// own, which passes through untouched below.
			formError.value = "This link is not valid. Ask for a new one.";
		}
		else if (field) errors.value[field] = message;
		else formError.value = message;
	}
	finally {
		pending.value = false;
	}
}
</script>
