<template>
  <div v-editable="blok">
    <StoryblokComponent
      v-for="nestedBlok in blok.body"
      :key="nestedBlok._uid"
      :blok="nestedBlok"
    />
  </div>
</template>

<script setup>
defineProps({
	blok: {
		type: Object,
		required: true,
	},
});
</script>
