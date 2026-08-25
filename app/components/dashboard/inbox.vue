<template>
	<div ref="root" class="inbox">
		<button
			type="button"
			class="inbox-trigger"
			:aria-expanded="open"
			aria-haspopup="true"
			:aria-label="unread ? `Activity, ${unread} unread` : 'Activity'"
			@click="toggle"
		>
			<NuxtDashboardIcon name="bell" />
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

			<p v-else class="inbox-empty">Nothing yet. New sales show up here.</p>
		</div>

		<!-- Toasts for sales that land while the dashboard is open. aria-live so
		     they are announced rather than being a purely visual event. -->
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
