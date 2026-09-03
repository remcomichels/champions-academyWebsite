<template>
	<p v-editable="blok" class="text-item">{{ blok.text }}</p>
</template>

<script setup lang="ts">
import type { TextBlok } from "~/types/blocks";

defineProps<{ blok: TextBlok }>();
</script>
