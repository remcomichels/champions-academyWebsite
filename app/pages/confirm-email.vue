<template>
	<div class="authSplit">
		<div class="authSplit-ghost" aria-hidden="true">
			<NuxtAuthGhost />
		</div>

		<section class="authSplit-form">
			<div class="authPane">
				<div class="authPane-glass">
					<div class="auth">
						<div class="auth-card">
							<!-- The whole page is one outcome, and it arrives after a
							     round trip rather than on load, so the region has to be
							     live from the start — see the same note in
							     reset-password.vue. -->
							<header class="auth-head" aria-live="polite">
								<!-- Nothing while the request is in flight: a mark that
								     appears and then changes its mind reads as a result
								     twice. The heading carries that state on its own. -->
								<span
									v-if="state !== 'working'"
									class="auth-check"
									:class="{ 'auth-check--bad': state === 'error' }"
									aria-hidden="true"
								>
									<NuxtDashboardIcon :name="state === 'done' ? 'check' : 'close'" />
								</span>

								<h1 class="auth-title">{{ heading }}</h1>
								<p class="auth-subTitle">{{ standfirst }}</p>
							</header>

							<!-- The address itself, which the standfirst cannot carry
							     because it is the one piece of this that varies. -->
							<p v-if="state === 'done'" class="auth-note">
								You'll sign in with <strong>{{ confirmed }}</strong> from now on.
							</p>

							<NuxtLink v-if="state !== 'working'" to="/dashboard/account" class="auth-alt">
								Go to your account
							</NuxtLink>

							<p v-if="state === 'error'" class="auth-help">
								<NuxtLink to="/login">Sign in</NuxtLink>
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
 * Confirms a new email address.
 *
 * No `auth` middleware: the token in the URL is the credential, and the link is
 * mailed to an address whose owner is very often reading it on a device that
 * has never signed in. Whether a session happens to be present makes no
 * difference to what this does.
 *
 * The confirmation is a POST fired from here rather than a GET on the link
 * itself, which is the point of the page existing at all — mail clients and
 * link scanners fetch URLs they are sent, and a single-use token spent by a
 * preview is a change the affiliate never gets to make. A scanner that does not
 * run scripts lands on this page and consumes nothing.
 */
definePageMeta({ layout: "auth" });

useSeoMeta({
	title: "Confirm your email address",
	robots: "noindex, nofollow",
});

const route = useRoute();
const router = useRouter();

/**
 * Read once, on load. Held in a ref rather than read from `route.query` at post
 * time because the URL is rewritten below — the token is a live credential and
 * does not belong in the address bar, the back stack, or a screenshot for any
 * longer than it takes to read it. Same reasoning as reset-password.vue.
 */
const token = ref(typeof route.query.token === "string" ? route.query.token : "");

const state = ref<"working" | "done" | "error">("working");
const confirmed = ref("");
const formError = ref("");

const heading = computed(() => {
	if (state.value === "done") return "Email address confirmed";
	if (state.value === "error") return "That link didn't work";
	return "Confirming your address…";
});

const standfirst = computed(() => {
	if (state.value === "done") return "That's the address on your account now.";
	// The specific reason, not a generic one above it. Both used to render —
	// a standfirst saying "you can ask for a new link" over a message saying
	// "or ask for a new one", which is the same sentence twice under a heading
	// that already said it did not work.
	if (state.value === "error") return formError.value || "Nothing has changed.";
	return "One moment — we're updating your account.";
});

onMounted(async () => {
	if (token.value) router.replace({ query: {} });

	if (!token.value) {
		state.value = "error";
		formError.value = "This link is incomplete. Open the link from your email exactly as it was sent, or ask for a new one.";
		return;
	}

	try {
		const result = await $fetch<{ email: string }>("/api/auth/confirm-email", {
			method: "POST",
			body: { token: token.value },
		});

		confirmed.value = result.email;
		state.value = "done";
	}
	catch (error) {
		const payload = (error as { data?: { statusMessage?: string } })?.data;
		formError.value = payload?.statusMessage ?? "Something went wrong. Please try again.";
		state.value = "error";
	}
	finally {
		// Whatever happened, it has happened — the token is spent either way and
		// there is nothing here worth a second attempt with the same value.
		token.value = "";
	}
});
</script>
