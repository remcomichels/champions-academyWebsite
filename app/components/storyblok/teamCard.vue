<template>
	<article v-editable="blok" class="team-card" :class="positionClass">
		<div class="team-card-content">
			<p class="team-card-name">{{ blok.name }}</p>
			<p class="team-card-subtext">{{ blok.sub_text }}</p>
		</div>

		<div class="team-card-image">
			<NuxtAppImage
				v-if="blok.image?.filename"
				:src="blok.image.filename"
				:alt="blok.image.alt || blok.name || ''"
				sizes="sm:200px md:200px lg:220px"
			/>
		</div>
	</article>
</template>

<script setup lang="ts">
const props = defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

// "Right" → image right / text left; "Left" → image left / text right.
const positionClass = computed(() =>
	String(props.blok.positioning).toLowerCase() === "left" ? "is-left" : "is-right",
);
</script>
