<template>
	<div ref="root" class="profileMenu">
		<button
			type="button"
			class="dashBar-avatar profileMenu-trigger tip tip--end"
			:aria-expanded="open"
			aria-haspopup="menu"
			data-tip="Account"
			:aria-label="open ? 'Close account menu' : `Account menu — ${displayName}`"
			@click="toggle"
		>
			<NuxtDashboardIcon name="user" class="profileMenu-face" />
		</button>

		<!-- Anchored to the trigger's right edge and hung below it. Not a
		     <dialog>: this is a menu, and a modal one would trap focus and dim
		     the page for what is mostly a set of links. -->
		<div v-if="open" class="profileMenu-panel" role="menu" :aria-label="`Account: ${displayName}`">
			<div class="profileMenu-identity">
				<p class="profileMenu-name">{{ displayName }}</p>
				<p v-if="email" class="profileMenu-email">{{ email }}</p>
			</div>

			<hr class="profileMenu-rule">

			<!-- One entry, not the two this menu used to carry. Account and
			     Settings are a single area with its own tabs now, so offering
			     both here would be two doors into the same room — and the menu
			     cannot say which tab you want anyway. -->
			<NuxtLink to="/dashboard/account" class="profileMenu-item" role="menuitem" @click="close">
				<NuxtDashboardIcon name="cog" />
				<span>Account settings</span>
			</NuxtLink>

			<NuxtLink to="/dashboard/changelog" class="profileMenu-item" role="menuitem" @click="close">
				<NuxtDashboardIcon name="changelog" />
				<span>Changelog</span>
			</NuxtLink>

			<hr class="profileMenu-rule">

			<!-- No icons on this group: four rows that differ only by a dot read
			     as one control, and a glyph on each would break them apart. -->
			<p class="profileMenu-groupLabel" id="theme-label">Theme</p>

			<div class="profileMenu-choices" role="radiogroup" aria-labelledby="theme-label">
				<button
					v-for="option in themeOptions"
					:key="option.value"
					type="button"
					class="profileMenu-item profileMenu-choice"
					role="radio"
					:aria-checked="choice === option.value"
					@click="pickTheme(option.value)"
				>
					<span class="profileMenu-dot" :class="{ 'is-on': choice === option.value }" aria-hidden="true" />
					<span>{{ option.label }}</span>
				</button>
			</div>

			<hr class="profileMenu-rule">

			<NuxtDashboardTimezoneMenu
				:model-value="timezone"
				@update:model-value="saveTimezone"
			/>

			<hr class="profileMenu-rule">

			<button type="button" class="profileMenu-item profileMenu-item--danger" role="menuitem" @click="logout">
				<NuxtDashboardIcon name="logout" />
				<span>Log out</span>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * The account menu behind the avatar in the top bar.
 *
 * Everything here is about the person rather than the work: who they are, where
 * their account settings live, how the dashboard should look, what timezone
 * their figures are in, and the way out. The rail is for places to go and do
 * something; none of this belonged in it.
 */
const { affiliate, logout: signOut } = useAuth();
const { choice, setTheme, options: themeOptions } = useTheme();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const displayName = computed(() => affiliate.value?.displayName ?? "Your account");
const email = computed(() => affiliate.value?.email ?? null);
const timezone = computed(() => affiliate.value?.timezone ?? "UTC");

const close = () => { open.value = false; };
const toggle = () => { open.value = !open.value; };

const pickTheme = (value: typeof choice.value) => {
	setTheme(value);
	// Deliberately stays open. Picking a theme is something you compare, and a
	// menu that closed on the first choice would make trying the other three a
	// matter of reopening it each time.
};

const logout = async () => {
	close();
	await signOut();
};

/**
 * Writes the timezone straight through rather than making it a Save button.
 * Every other row in this menu takes effect on click, and a form control in a
 * menu that needed confirming would be the odd one out.
 *
 * `fetchMe(true)` rather than patching the local ref: the server canonicalises
 * the spelling, so re-reading is how the menu ends up showing what was actually
 * stored.
 */
const { fetchMe } = useAuth();

const saveTimezone = async (next: string) => {
	if (!next || next === timezone.value) return;

	try {
		await $fetch("/api/affiliate/profile", { method: "PATCH", body: { timezone: next } });
		await fetchMe(true);
		// A hard reload, for the same reason stopViewingAs does one: every
		// figure on the page was bucketed by the old zone server-side, and
		// there is no cheap way to invalidate all of it.
		await refreshNuxtData();
	}
	catch {
		// Swallowed on purpose. The field re-reads from `affiliate` on the next
		// open, so a rejected save simply shows the old zone again rather than
		// putting an error state inside a menu.
		await fetchMe(true);
	}
};

// Click-outside and Escape. Bound only while open, so the dashboard is not
// carrying two document listeners around on every page for a closed menu.
watch(open, (isOpen) => {
	if (!import.meta.client) return;

	const onPointer = (event: PointerEvent) => {
		if (!root.value?.contains(event.target as Node)) close();
	};

	const onKey = (event: KeyboardEvent) => {
		if (event.key === "Escape") close();
	};

	if (isOpen) {
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		cleanup = () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}
	else {
		cleanup?.();
		cleanup = null;
	}
});

let cleanup: (() => void) | null = null;

// Navigating away from under an open menu leaves it open over the new page.
const route = useRoute();
watch(() => route.fullPath, close);

onUnmounted(() => cleanup?.());
</script>
