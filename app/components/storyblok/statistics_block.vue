<template>
	<section :id="blok.anchor || undefined" ref="root" v-editable="blok" data-scroll-inview class="statistics_block">
		<div class="container statistics-container">
            <p class="preText">{{ blok.pre_text_line }}</p>
            <div v-if="blok.statistic?.length" class="statistics-list">
                <StoryblokComponent
                    v-for="statisticBlok in blok.statistic"
                    :key="statisticBlok._uid"
                    :blok="statisticBlok"
                />
            </div>
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

const root = useTemplateRef<HTMLElement>("root");
const { initCountUp, destroy } = useCountUp(root);

onMounted(() => initCountUp());
onUnmounted(() => destroy());
</script>