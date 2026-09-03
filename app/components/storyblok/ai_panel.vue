<!-- eslint-disable vue/multi-word-component-names -->
<template>
	<div v-editable="blok" class="amethyst-container ai-panel">
		<div class="text-container">
			<p class="subTitle">{{ blok.sub_title }}</p>
			<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
			<p class="text">{{ blok.text }}</p>

			<div v-if="blok.steps?.length" class="steps-container">
				<StoryblokComponent
					v-for="stepBlok in blok.steps"
					:key="stepBlok._uid"
					:blok="asBlok(stepBlok)"
				/>
			</div>

			<div v-if="blok.button?.length" class="button-container">
				<StoryblokComponent
					v-for="buttonBlok in blok.button"
					:key="buttonBlok._uid"
					:blok="asBlok(buttonBlok)"
				/>
			</div>
		</div>

		<div class="amethyst-video">
			<NuxtVideoPlayer v-if="blok.video_id" :video-id="blok.video_id" />
		</div>
	</div>
</template>

<script setup lang="ts">
import type { AiPanelBlok } from "~/types/blocks";

// One AI's content, rendered inside amethyst_block's switcher. The parent owns
// the tabs, the slide transition and the auto-switch timer; this block is just
// the layout. The title keeps `data-scroll-letters` so the initially-active
// panel gets the letter reveal (driven by the parent) — panels swapped in later
// simply render the title as-is, which is fine since nothing hides it.
defineProps<{ blok: AiPanelBlok }>();
</script>
