<template>
	<!-- A real checkbox, not a div with a click handler: this is a two-state
	     control, and `role="switch"` on an <input type="checkbox"> is announced
	     as on/off by every screen reader without any aria-* bookkeeping. -->
	<label class="modeSwitch" :class="{ 'is-on': adminMode }">
		<input
			class="modeSwitch-input"
			type="checkbox"
			role="switch"
			:checked="adminMode"
			@change="onChange"
		>
		<span class="modeSwitch-label">Admin</span>
		<span class="modeSwitch-track" aria-hidden="true">
			<span class="modeSwitch-knob" />
		</span>
	</label>
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

const onChange = (event: Event) => {
	setAdminMode((event.target as HTMLInputElement).checked);
};
</script>
