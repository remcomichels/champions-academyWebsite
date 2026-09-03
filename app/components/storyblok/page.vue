<template>
  <div v-editable="blok">
    <StoryblokComponent
      v-for="nestedBlok in body"
      :key="nestedBlok._uid"
      :blok="asBlok(nestedBlok)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SbBlokData } from "@storyblok/vue";
import type { PageBlok } from "~/types/blocks";

const props = defineProps<{ blok: PageBlok }>();

// The generator emits `unknown[]` for a bloks field, since what a page can
// contain is decided in the CMS rather than in the schema. Every entry is a
// blok, which is what <StoryblokComponent> needs to resolve one.
const body = computed(() => (props.blok.body ?? []) as SbBlokData[]);
</script>
