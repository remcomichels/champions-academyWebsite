<template>
	<!-- link: underline hover pattern -->
	<NuxtLink
		v-if="href && variant === 'link'"
		v-editable="blok"
		:to="href"
		v-bind="storyblokLinkAttrs(blok.link)"
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
		v-bind="storyblokLinkAttrs(blok.link)"
		class="button button__secondary"
	>
		{{ blok.title }}
	</NuxtLink>

	<!-- primary (default): label segment + plus segment -->
	<NuxtLink v-else-if="href" v-editable="blok" :to="href" v-bind="storyblokLinkAttrs(blok.link)" class="button">
		<span class="textWrap button__primary">{{ blok.title }}</span>
		<span class="plus icon-plus" />
	</NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

const href = computed(() => resolveStoryblokLink(props.blok.link));

// Fall back to primary for bloks created before the variant field existed
const variant = computed(() => props.blok.variant || "primary");
</script>
