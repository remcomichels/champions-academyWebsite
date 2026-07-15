<template>
	<p v-editable="blok" class="text-item">{{ blok.text }}</p>
</template>

<script setup lang="ts">
defineProps({
	blok: {
		type: Object,
		required: true,
	},
});
</script>
