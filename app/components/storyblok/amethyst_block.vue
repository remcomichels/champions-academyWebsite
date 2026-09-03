<template>
	<section :id="blok.anchor || undefined" ref="root" v-editable="blok" data-scroll-inview class="section amethyst_block">
		<div class="container amethyst-inner">
			<div v-if="panels.length > 1" class="ai-tabs" role="tablist">
				<button
					v-for="(panel, i) in panels"
					:key="panel._uid"
					type="button"
					class="ai-tab"
					:class="{ active: i === activeIndex }"
					role="tab"
					:aria-selected="i === activeIndex"
					@click="select(i)"
				>
					<span class="ai-tab-label">{{ panel.tab_label }}</span>
					<span class="ai-tab-track">
						<span
							v-if="i === activeIndex && !reduced"
							class="ai-tab-fill"
							:style="fillStyle"
							@animationend="onCycleEnd"
						/>
					</span>
				</button>
			</div>

			<div class="ai-panel-viewport">
				<Transition :name="transitionName" mode="out-in">
					<StoryblokComponent
						v-if="activePanel"
						:key="activePanel._uid"
						:blok="asBlok(activePanel)"
					/>
				</Transition>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { AmethystBlockBlok, AiPanelBlok } from "~/types/blocks";

import { useAmethystSwitcher } from "~/assets/js/components/amethyst_block";

const props = defineProps<{ blok: AmethystBlockBlok }>();

// Typed for the tab list (index + tab_label). `activePanel` below stays loose
// because <StoryblokComponent>'s `blok` prop is the broad SbBlokData.
const panels = computed<AiPanelBlok[]>(() => props.blok.panels ?? []);

// Storyblok sends the number field as a string ("15"); fall back to 15.
const seconds = computed(() => {
	const parsed = Number(props.blok.auto_switch_seconds);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
});

const root = useTemplateRef<HTMLElement>("root");
const { reduced } = useReducedMotion();

const { activeIndex, direction, paused, select, onCycleEnd } = useAmethystSwitcher(
	root,
	() => panels.value.length,
);

const activePanel = computed(() => props.blok.panels?.[activeIndex.value] ?? null);
const transitionName = computed(() => (direction.value >= 0 ? "ai-fwd" : "ai-back"));

// The fill length is the auto-switch interval; play-state freezes it (and the
// `animationend` that advances the panel) whenever the block is off-screen.
const fillStyle = computed(() => ({
	animationDuration: `${seconds.value}s`,
	animationPlayState: paused.value ? "paused" : "running",
}));

// Letter reveal for the initially-active panel's title (scroll-triggered). Only
// the first panel is in the DOM at mount, so only it is split/animated; later
// panels render their title as-is.
const { initLetters, destroy } = useLetterAnimation();
onMounted(() => initLetters());
onUnmounted(() => destroy());
</script>
