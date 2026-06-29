<template>
  <img
    v-if="isSvg"
    v-bind="$attrs"
    :src="src"
  >
  <NuxtImg
    v-else
    v-bind="$attrs"
    :src="src"
    :width="dimensions?.width"
    :height="dimensions?.height"
    provider="storyblok"
    format="webp"
  />
</template>

<script setup>
defineOptions({ inheritAttrs: false })

const props = defineProps({
  src: {
    type: String,
    default: '',
  },
})

const isSvg = computed(() => props.src?.toLowerCase().endsWith('.svg'))

// Storyblok asset URLs embed the original dimensions, e.g.
//   https://a.storyblok.com/f/<space>/<width>x<height>/<hash>/<file>
// Parse them so every image carries its intrinsic aspect ratio and reserves
// space (no layout shift) without hand-setting width/height per component.
// CSS (object-fit/aspect-ratio) still controls how it actually renders.
const dimensions = computed(() => {
  const match = props.src?.match(/\/(\d+)x(\d+)\//)
  if (!match) return null
  return { width: Number(match[1]), height: Number(match[2]) }
})
</script>