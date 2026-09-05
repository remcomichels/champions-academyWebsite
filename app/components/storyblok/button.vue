<template>
	<!-- link: underline hover pattern -->
	<NuxtLink
		v-if="href && variant === 'link'"
		v-editable="blok"
		:to="href"
		v-bind="linkAttrs"
		class="button-link parent-link"
	>
		{{ blok.title }}
		<span class="link-line" />
	</NuxtLink>

	<!-- secondary: single solid pill -->
	<NuxtLink
		v-else-if="href && variant === 'secondary'"
		v-editable="blok"
		:to="href"
		v-bind="linkAttrs"
		class="button button__secondary"
	>
		{{ blok.title }}
	</NuxtLink>

	<!-- primary (default): label segment + plus segment -->
	<NuxtLink v-else-if="href" v-editable="blok" :to="href" v-bind="linkAttrs" class="button">
		<span class="textWrap button__primary">{{ blok.title }}</span>
		<span class="plus icon-plus" />
	</NuxtLink>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { ButtonBlok } from "~/types/storyblok";

const props = defineProps({
	blok: {
		type: Object as PropType<ButtonBlok>,
		required: true,
	},
});

const roleHref = useRoleHref();

// A button with a link_role is centrally managed: its href comes from the
// referring affiliate or the config-story default, and the CMS link field is
// ignored. Without a role it behaves exactly as it always has.
const href = computed(() =>
	roleHref(props.blok.link_role, resolveStoryblokLink(props.blok.link)),
);

// Managed links are always external by definition of the host allow-list, so
// they open in a new tab rather than navigating the visitor off the page
// mid-funnel. Unmanaged links keep whatever the CMS specified.
const linkAttrs = computed(() =>
	props.blok.link_role
		? { target: "_blank", rel: "noopener noreferrer" }
		: storyblokLinkAttrs(props.blok.link),
);

// Fall back to primary for bloks created before the variant field existed
const variant = computed(() => props.blok.variant || "primary");
</script>
