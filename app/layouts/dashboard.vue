<template>
	<div id="pageContainer" class="dashLayout">
		<div class="bgSun" aria-hidden="true" />

		<header class="dashBar">
			<div class="dashBar-inner">
				<NuxtLink to="/" class="dashBar-brand">Champions Academy</NuxtLink>

				<div class="dashBar-right">
					<NuxtLink v-if="isAdmin" to="/dashboard/admin" class="dashBar-link">Admin</NuxtLink>
					<span v-if="affiliate" class="dashBar-who">{{ affiliate.displayName }}</span>
					<button type="button" class="dashBar-logout" @click="logout">Log out</button>
				</div>
			</div>
		</header>

		<!-- NuxtPage, not <slot />: app.vue renders a bare <NuxtLayout />, so the
		     layout mounts the page itself. A slot here renders an empty main. -->
		<main id="main" tabindex="-1" class="dashLayout-main">
			<NuxtPage />
		</main>
	</div>
</template>

<script setup lang="ts">
const { isAdmin, affiliate, logout, fetchMe } = useAuth();

// The auth middleware has already populated this, but a direct load of a
// nested route should not depend on that ordering.
await fetchMe();
</script>
