<template>
	<section :id="blok.anchor || undefined" v-editable="blok" data-scroll-inview class="section video_block">
		<div class="container-wide video-container">
            <div class="title-container">
                <p class="subTitle">{{ blok.sub_title }}</p>
                <h3 data-letters class="title"> {{ blok.title }} </h3>
            </div>
            <NuxtVideoPlayer
                v-if="blok.video_id"
                :video-id="blok.video_id"
                :title="blok.video_title || ''"
                :autoplay="blok.autoplay || false"
                :loop="blok.loop || false"
                :show-controls="blok.show_controls ?? true"
                :poster="blok.poster_image?.filename || ''"
            />
		</div>
	</section>
</template>

<script setup lang="ts">
defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

const { initLetters, destroy } = useLetterAnimation()

onMounted(() => {
	initLetters()
})

onUnmounted(() => {
  destroy()
})
</script>