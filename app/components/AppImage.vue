<template>
  <!--
    `loading` is declared before `v-bind="$attrs"` on purpose: later bindings
    win, so this is a default a call site can still override with
    `loading="eager"`. Anything painted above the fold should do exactly that —
    lazy-loading the image a visitor is already looking at delays it for no
    gain. Everything else on these pages is well below the fold, and eager was
    costing ~538 KB of images fetched before anyone scrolled to them.
  -->
  <img
    v-if="passthrough"
    loading="lazy"
    v-bind="$attrs"
    :src="src"
  >
  <NuxtImg
    v-else
    loading="lazy"
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

// Anything not served from a remote host — i.e. everything under /public.
// Protocol-relative counts as remote; Storyblok URLs turn up both ways.
const isLocal = computed(() => !/^(https?:)?\/\//i.test(props.src ?? ''))

/**
 * Rendered as a plain <img>, with no provider involved.
 *
 * SVGs bypass because there is nothing to resize. Local files bypass because
 * `provider="storyblok"` below is not a preference — it is the only image
 * provider this project configures, and it can only transform assets Storyblok
 * hosts. Handing it `/images/foo.webp` builds a CDN URL for a host that does
 * not have the file, so a local raster would simply not load.
 *
 * This was latent until the platform logos landed: every local image before
 * them was an SVG and took the other branch. Files we ship ourselves are
 * already the size they are used at, so there is nothing for a CDN to do.
 */
const passthrough = computed(() => isSvg.value || isLocal.value)

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