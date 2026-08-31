<template>
	<div ref="root" class="inbox">
		<button
			type="button"
			class="inbox-trigger tip"
			:aria-expanded="open"
			aria-haspopup="true"
			:data-tip="unread ? `Activity — ${unread} unread` : 'Activity'"
			:aria-label="unread ? `Activity, ${unread} unread` : 'Activity'"
			@click="toggle"
		>
			<NuxtDashboardIcon name="bell" class="dashBar-glyph" />
			<span v-if="unread" class="inbox-badge">{{ unread > 9 ? "9+" : unread }}</span>
		</button>

		<div v-if="open" class="inbox-panel">
			<p class="inbox-title">Activity</p>

			<ul v-if="items.length" class="inbox-list">
				<li
					v-for="item in items"
					:key="item.id"
					class="inbox-item"
					:class="{ 'is-unread': !item.read }"
				>
					<span class="inbox-text">{{ describe(item) }}</span>
					<span class="inbox-when">{{ formatWhen(item.createdAt) }}</span>
				</li>
			</ul>

			<p v-else class="inbox-empty">Nothing yet. Activity on your account shows up here.</p>
		</div>

		<!-- Toasts for activity that lands while the dashboard is open. aria-live
		     so it is announced rather than being a purely visual event. -->
		<div class="toasts" aria-live="polite" aria-atomic="false">
			<div v-for="toast in toasts" :key="toast.id" class="toast">
				{{ describe(toast) }}
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useInbox } from "~/assets/js/components/inbox";

const { open, root, toggle, items, unread, toasts, describe, formatWhen } = useInbox();
</script>
