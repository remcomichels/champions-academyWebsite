<template>
	<div class="authSplit">
		<!-- The dashboard, blurred, under everything. Both sections sit on it and
		     the gap between them is where you see it plainly — which is what makes
		     them read as two panes laid on a screen rather than two halves of one. -->
		<div class="authSplit-ghost" aria-hidden="true">
			<NuxtAuthGhost />
		</div>

		<section class="authSplit-form">
			<div class="authPane">
				<!-- The glass: full height, half width, which is this pane. The
				     dashboard it frosts is the page-wide layer above, showing
				     through. -->
				<div class="authPane-glass">
					<div class="auth">
						<div class="auth-card">
							<header class="auth-head">
								<h1 class="auth-title">
									{{ mode === "login" ? "Affiliate sign in" : "Set up your account" }}
								</h1>
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
									label="Email address"
									type="email"
									inputmode="email"
									autocomplete="email"
									placeholder="you@example.com"
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
									placeholder="you@example.com"
									:error="errors.emailConfirm"
									required
								/>

								<!-- Starts the second half of the invite form. See the
								     margin note in auth.less. -->
								<NuxtAuthField
									v-model="form.password"
									:class="{ 'auth-groupStart': mode === 'redeem' }"
									label="Password"
									type="password"
									:autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
									:placeholder="mode === 'login' ? 'Your password' : 'At least 12 characters'"
									:error="errors.password"
									required
								/>

								<NuxtAuthField
									v-if="mode === 'redeem'"
									v-model="form.passwordConfirm"
									label="Confirm password"
									type="password"
									autocomplete="new-password"
									placeholder="Repeat your password"
									:error="errors.passwordConfirm"
									required
								/>

								<!-- Under the field it belongs to, as in the reference,
								     rather than stranded in the footer below the
								     button. Sign-in only: there is no password to
								     have forgotten before the account exists. -->
								<p v-if="mode === 'login'" class="auth-recover">
									<NuxtLink to="/forgot-password">Forgot your password?</NuxtLink>
								</p>

								<!-- Redeeming has no equivalent of "forgot your
								     password" — an invite code that does not work is
								     not something the person holding it can resolve
								     from here, and a link saying so would be an exit
								     with nowhere to go. A rule keeps the same beat
								     between the last field and the button without
								     inventing a destination. -->
								<div v-else class="auth-rule" aria-hidden="true" />

								<button type="submit" class="btn btn--primary auth-submit" :disabled="pending">
									{{ pending
										? "Working…"
										: mode === "login" ? "Sign in" : "Create account" }}
								</button>
							</form>

							<!-- The same pair in both directions: a rule, an "or", and
							     the alternative as a button of equal weight. Redeeming
							     an invite really is the other way in, and returning to
							     sign-in really is the way back out.
							
							     This was a text link on the invite form for a while,
							     because five fields on a locked viewport left no room
							     for a second button. Dropping the standfirst and the
							     field hints gave it back. -->
							<div class="auth-or" role="presentation">
								<span>or</span>
							</div>

							<button
								type="button"
								class="auth-alt"
								@click="setMode(mode === 'login' ? 'redeem' : 'login')"
							>
								{{ mode === "login"
									? "I have an invite code"
									: "I already have an account" }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Right half: unchanged, just moved across. -->
		<section class="authSplit-visual" aria-hidden="true">
			<!-- Local files take AppImage's passthrough branch — the Storyblok
			     provider cannot transform anything under /public — so `sizes`
			     and `preload` would be inert here and the file has to arrive at
			     the size it is used at. Hence the .webp: the 1528x2734 PNG was
			     4.8 MB, unoptimised, on a page whose whole job is a login form.
			     `loading`/`fetchpriority` are the real <img> attributes, and
			     this one is very much above the fold. -->
			<NuxtAppImage
				class="authSplit-backdrop"
				src="/images/background-login.webp"
				alt=""
				loading="eager"
				fetchpriority="high"
			/>

			<NuxtAvatar
				class="authSplit-avatar"
				definition-url="/avatar/cloudee.avatar.json"
				animation="builderpro"
				body-color="--accent"
				label="Champions Academy avatar"
			>
				<template #fallback>
					<span class="authSplit-mark">CA</span>
				</template>
			</NuxtAvatar>
		</section>
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
