<template>
	<!-- Two radios in a group, not a checkbox.
	     "Admin: on/off" was the wrong shape for this: the affiliate side is not
	     the absence of the admin side, it is the other half of a pair, and a
	     switch made one of the two the default state and the other a deviation
	     from it. A radiogroup says what this actually is — two modes, one
	     current — and arrow keys move between them for free. -->
	<div class="modeSwitch" role="radiogroup" aria-label="Dashboard mode">
		<!-- Slides between the two. Behind the labels and out of the a11y tree:
		     it is the same information the checked state already carries. -->
		<span class="modeSwitch-indicator" :class="{ 'is-admin': adminMode }" aria-hidden="true" />

		<label
			v-for="option in options"
			:key="option.label"
			class="modeSwitch-option"
			:class="{ 'is-active': adminMode === option.value }"
		>
			<input
				class="modeSwitch-input"
				type="radio"
				name="dashboard-mode"
				:checked="adminMode === option.value"
				@change="setAdminMode(option.value)"
			>
			<span class="modeSwitch-text">{{ option.label }}</span>
		</label>
	</div>
</template>

<script setup lang="ts">
/**
 * Swaps the dashboard between an affiliate's own pages and the admin ones.
 *
 * Only rendered for admins — see the guard in the layout. It grants nothing on
 * its own: the API re-checks requireAdmin on every call and the route
 * middleware still guards the pages, so flipping this in devtools changes
 * which links are drawn and nothing else.
 */
const { adminMode, setAdminMode } = useDashboardNav();

const options = [
	{ value: false, label: "Personal" },
	{ value: true, label: "Admin" },
] as const;
</script>
