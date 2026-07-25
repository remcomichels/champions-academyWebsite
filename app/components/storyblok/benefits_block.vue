<template>
	<section v-editable="blok" data-scroll-inview class="section benefits_block">
		<div class="container benefits-container">
			<div class="text-container">
				<p class="subText">{{ blok.sub_text }}</p>
				<div class="title-container">
					<h2 data-scroll-letters class="title">{{ blok.title }}</h2>
					<h3 class="subTitle">{{ blok.sub_title }}</h3>
				</div>
				<p class="text">{{ blok.text }}</p>
				<div v-if="blok.button?.length" class="button-container">
					<StoryblokComponent
						v-for="buttonBlok in blok.button"
						:key="buttonBlok._uid"
						:blok="buttonBlok"
					/>
				</div>
			</div>

			<div
				v-if="cards.length"
				ref="grid"
				class="benefits-grid"
				@pointermove="onPointerMove"
				@pointerleave="onPointerLeave"
			>
				<article v-for="{ story, media } in cards" :key="story.uuid" class="benefit-card">
					<div class="benefit-media" aria-hidden="true">
						<NuxtAppImage
							v-if="media"
							class="benefit-image benefit-image--dim"
							:src="media.src"
							:alt="media.alt"
							sizes="sm:100vw md:50vw lg:34vw"
						/>
						<!-- Liquid trail — masked shape, merged into metaballs by the goo filter -->
						<div class="benefit-blob">
							<span class="benefit-blob-shape" />
						</div>
					</div>
					<h4 class="benefit-title">{{ story.name }}</h4>
					<p v-if="story.content?.text" class="benefit-text">{{ story.content.text }}</p>
				</article>

				<!-- Gooey filter: blur + alpha threshold merges the trail circles
				     into one flowing liquid mass. Referenced by .benefit-blob. -->
				<svg class="benefit-goo-defs" width="0" height="0" aria-hidden="true" focusable="false">
					<defs>
						<filter id="benefitGoo" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
							<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
							<feColorMatrix
								in="blur"
								type="matrix"
								values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
							/>
						</filter>
					</defs>
				</svg>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { BenefitStoryRef } from "~/types/storyblok";

const props = defineProps({
	blok: {
		type: Object,
		required: true,
	},
});

// The `benefit` multi-options field stores story UUIDs; resolve_relations in
// [...slug].vue swaps them for full story objects. Skip any that stayed
// unresolved (raw UUID strings).
const benefits = computed<BenefitStoryRef[]>(() =>
	(props.blok.benefit ?? []).filter(
		(entry: unknown): entry is BenefitStoryRef => typeof entry === "object" && entry !== null,
	),
);

interface CardMedia { src: string; alt: string }

// The benefit story's `image` asset (square). Object-fit: cover in the LESS
// keeps any source square inside the 1:1 card.
function mediaOf(story: BenefitStoryRef): CardMedia | null {
	const img = story.content?.image as { filename?: string; alt?: string } | undefined;
	if (!img?.filename) return null;
	return { src: img.filename, alt: img.alt || story.name || "" };
}

const cards = computed(() => benefits.value.map((story) => ({ story, media: mediaOf(story) })));

// ── Reveal blob ────────────────────────────────────────────────────────────
// A soft blob brightens the dimmed card images within its circle. To feel like
// moving liquid it's a chain of nodes: the head chases the target, each node
// chases the one ahead. Fast motion stretches the chain into a tail; slowing
// lets it pool back into a circle. It drifts over the grid on its own (a slow
// Lissajous path) as a hint that images are there, and follows the pointer while
// the cursor is over the grid — desktop only; touch keeps the auto-wander. Each
// node is written to every card as --x{i}/--y{i} (relative to that card) so the
// mask's tapering circles merge across the gaps. RAF runs only while on-screen.
const TRAIL = 6;
const { reduced } = useReducedMotion();
const grid = useTemplateRef<HTMLElement>("grid");

let raf: number | null = null;
let io: IntersectionObserver | null = null;
let desktopHover: MediaQueryList | null = null;
let visible = false;
let following = false;
let seeded = false;
let t = 0;
const target = { x: 0, y: 0 };
const trail = Array.from({ length: TRAIL }, () => ({ x: 0, y: 0 }));

function isDesktop(): boolean {
	desktopHover ??= window.matchMedia("(hover: hover) and (min-width: 1081px)");
	return desktopHover.matches;
}

// Autonomous target: two out-of-phase sines trace a loop within the grid, and
// the drift speed itself breathes on a ~10s cycle — skewed to linger in the slow
// (pooling) phase longer than the fast (stretching) one. The phase warp
// (w + k·sin w) races through the peak and dwells at the trough, giving roughly
// 4s fast / 6s slow so the liquid read stays lively instead of stale.
function wander(rect: DOMRect): void {
	const w = (performance.now() / 10000) * Math.PI * 2;
	const osc = Math.cos(w + 0.6 * Math.sin(w)); // 1 = fast, -1 = slow (lingers here)
	t += 0.0115 + osc * 0.0085; // 0.02 (stretch) ↔ 0.003 (pool)
	target.x = rect.left + rect.width / 2 + Math.sin(t * 1.1) * rect.width * 0.4;
	target.y = rect.top + rect.height / 2 + Math.sin(t * 1.7 + 0.6) * rect.height * 0.4;
}

function render(): void {
	const el = grid.value;
	if (!el || !visible) {
		raf = null;
		return;
	}

	if (!following) wander(el.getBoundingClientRect());

	// Head eases toward the target; each node eases toward the node ahead of it.
	// Looser factors let the chain lag apart into a longer, liquid tail.
	trail[0]!.x += (target.x - trail[0]!.x) * 0.18;
	trail[0]!.y += (target.y - trail[0]!.y) * 0.18;
	for (let i = 1; i < TRAIL; i++) {
		trail[i]!.x += (trail[i - 1]!.x - trail[i]!.x) * 0.28;
		trail[i]!.y += (trail[i - 1]!.y - trail[i]!.y) * 0.28;
	}

	el.querySelectorAll<HTMLElement>(".benefit-card").forEach((card) => {
		const r = card.getBoundingClientRect();
		for (let i = 0; i < TRAIL; i++) {
			card.style.setProperty(`--x${i}`, `${trail[i]!.x - r.left}px`);
			card.style.setProperty(`--y${i}`, `${trail[i]!.y - r.top}px`);
		}
	});

	raf = requestAnimationFrame(render);
}

function start(): void {
	if (raf === null && visible && !reduced.value) raf = requestAnimationFrame(render);
}

function onPointerMove(event: PointerEvent): void {
	if (!isDesktop()) return; // touch keeps the auto-wander
	following = true;
	target.x = event.clientX;
	target.y = event.clientY;
}

function onPointerLeave(): void {
	// Hand back to the auto-wander from the blob's current position (it eases).
	following = false;
}

const { initLetters, destroy } = useLetterAnimation();

onMounted(() => {
	initLetters();
	if (reduced.value) return; // reduced motion: images stay fully revealed (LESS)

	const el = grid.value;
	if (!el) return;

	io = new IntersectionObserver(
		(entries) => {
			visible = !!entries[0]?.isIntersecting;
			if (!visible) return;
			if (!seeded) {
				const r = el.getBoundingClientRect();
				const cx = r.left + r.width / 2;
				const cy = r.top + r.height / 2;
				target.x = cx;
				target.y = cy;
				trail.forEach((node) => { node.x = cx; node.y = cy; });
				seeded = true;
			}
			start();
		},
		{ threshold: 0 },
	);
	io.observe(el);
});

onUnmounted(() => {
	destroy();
	if (raf !== null) cancelAnimationFrame(raf);
	io?.disconnect();
});
</script>
