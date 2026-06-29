import { onMounted, onBeforeUnmount, type Ref } from "vue";

// ─────────────────────────────────────────────────────────────────────────────
// useMarquee
//
// Infinite horizontal marquee whose speed reacts to page scroll velocity. It
// animates two identical, leap-frogging tracks for a seamless endless strip,
// rides the shared rAF, and is tuned entirely through data attributes. Shown
// static (no auto-scroll) under reduced motion.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Travel direction of the marquee when scroll velocity is neutral. */
type Direction = "left" | "right";

/**
 * Whether the marquee runs in its base direction ("normal") or flipped
 * ("inverted"). Driven live by scroll direction — see onScroll below.
 */
type Status = "normal" | "inverted";

/** One scroll-position reading, used to derive scroll velocity over a window. */
type ScrollSample = { y: number; t: number };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (pure — no instance state)
// ─────────────────────────────────────────────────────────────────────────────

/** Constrain `v` to the inclusive [min, max] range. */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Linear interpolation from `a` to `b` by factor `t` (0–1). Used for smoothing. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Read a numeric attribute, falling back to `fallback` when missing/invalid. */
function readNumberAttr(el: HTMLElement, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Read an attribute constrained to a fixed set of allowed strings, falling back
 * to `fallback` when the attribute is missing or not one of the allowed values.
 */
function readEnumAttr<T extends string>(
  el: HTMLElement,
  name: string,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = el.getAttribute(name);
  return raw && allowed.includes(raw as T) ? (raw as T) : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Infinite horizontal marquee whose speed reacts to page scroll velocity.
 *
 * It animates two identical, side-by-side tracks (A and B). B is positioned one
 * track-width to the right of A, and both translate by the same `x`. When `x`
 * crosses a full track-width it wraps by exactly that width, so the two tracks
 * leap-frog each other and the strip appears seamless and endless.
 *
 * Base speed comes from `data-marquee-speed`; on top of that, the faster the
 * user scrolls the page, the faster the marquee runs (a smoothed 1–8× boost),
 * and scroll direction can flip the travel direction.
 *
 * All four elements are passed as refs so the consuming component owns the
 * template; the composable only reads/writes their transforms and attributes.
 *
 * @param marqueeEl  The marquee root. Reads its tuning data-attributes (see below)
 *                   and receives `data-marquee-status` as scroll direction changes.
 * @param scrollEl   The element wrapping both tracks. Made `position: relative`
 *                   here; reads `data-scroll-speed` as a per-instance speed multiplier.
 * @param trackA     First track. Measured to determine the wrap width.
 * @param trackB     Second (duplicate) track, positioned absolutely after A.
 *
 * ── data-attributes read from `marqueeEl` ──────────────────────────────────
 *   data-marquee-speed            Base speed in px/sec.                Default 20
 *   data-marquee-direction        "left" | "right" base direction.    Default "left"
 *   data-marquee-touch-threshold  Min scroll delta (px) to flip the
 *                                 direction. Default 0.25 on coarse
 *                                 pointers (touch), else 1.
 *   data-marquee-velocity-timeout Idle ms after the last scroll event
 *                                 before the velocity boost decays.   Default 80
 *   data-marquee-sample-window    Time window (ms) over which scroll
 *                                 velocity is averaged.               Default 120
 *   data-marquee-status           Set BY the composable ("normal" |
 *                                 "inverted"); you normally don't set it.
 *
 * ── data-attribute read from `scrollEl` ────────────────────────────────────
 *   data-scroll-speed             Multiplier applied to the base speed. Default 1
 */
export function useMarquee(
  marqueeEl: Ref<HTMLElement | null>,
  scrollEl: Ref<HTMLElement | null>,
  trackA: Ref<HTMLElement | null>,
  trackB: Ref<HTMLElement | null>
): void {
  // ResizeObserver re-measures track width when its content/box changes.
  let resizeObs: ResizeObserver | null = null;

  // Current horizontal offset (px) shared by both tracks, and the wrap distance.
  let x = 0;
  let trackWidth = 0;

  // Subscribe to the app-wide shared rAF instead of running our own loop.
  const { add } = useRaf();
  const { reduced } = useReducedMotion();

  // Scroll-velocity state. rawVelocity is the freshly measured px/sec; it is
  // eased into smoothedVelocity so the speed boost never jumps abruptly.
  let rawVelocity = 0;
  let smoothedVelocity = 0;

  // Rolling buffer of recent scroll positions used to compute rawVelocity, plus
  // bookkeeping for the last scroll event time / position.
  const samples: ScrollSample[] = [];
  let lastScrollEventTime = 0;
  let lastScrollY = 0;

  onMounted(() => {
    const marquee = marqueeEl.value;
    const scroll = scrollEl.value;
    const a = trackA.value;
    const b = trackB.value;

    // HARD GUARD — after this, all are HTMLElement
    if (!marquee || !scroll || !a || !b) return;

    // The tracks are positioned relative to this wrapper.
    scroll.style.position = "relative";

    // ── Measure track width and park track B one width to the right ─────────
    // Transforms are temporarily cleared so getBoundingClientRect reports the
    // untransformed layout width, then restored so the marquee doesn't jump.
    const measureAndPosition = () => {
      const prevA = a.style.transform;
      const prevB = b.style.transform;

      a.style.transform = "translate3d(0,0,0)";
      b.style.transform = "translate3d(0,0,0)";

      const w = a.getBoundingClientRect().width;
      if (w > 0) {
        trackWidth = w;
        b.style.position = "absolute";
        b.style.left = `${Math.ceil(trackWidth)}px`;
        b.style.top = "0px";
      }

      a.style.transform = prevA;
      b.style.transform = prevB;
    };

    measureAndPosition();

    // Re-measure when the track resizes (font load, content change, …) or the
    // window resizes.
    resizeObs = new ResizeObserver(measureAndPosition);
    resizeObs.observe(a);

    const onResize = () => measureAndPosition();
    window.addEventListener("resize", onResize, { passive: true });

    // Reduced motion: show the strip statically — no auto-scroll, no velocity
    // reactivity. Keep only the resize re-measure so it stays laid out correctly.
    if (reduced.value) {
      onBeforeUnmount(() => {
        window.removeEventListener("resize", onResize);
        resizeObs?.disconnect();
      });
      return;
    }

    // ── Read tuning attributes (with touch-aware flip threshold) ────────────
    const isCoarsePointer =
      window.matchMedia?.("(pointer: coarse)").matches ?? false;

    const flipThreshold = readNumberAttr(
      marquee,
      "data-marquee-touch-threshold",
      isCoarsePointer ? 0.25 : 1
    );

    const velocityTimeoutMs = readNumberAttr(
      marquee,
      "data-marquee-velocity-timeout",
      80
    );

    const sampleWindowMs = readNumberAttr(
      marquee,
      "data-marquee-sample-window",
      120
    );

    lastScrollY = window.scrollY;
    lastScrollEventTime = performance.now();

    // Record a scroll position and drop samples older than the averaging window.
    const pushSample = (y: number, t: number) => {
        samples.push({ y, t });

        const cutoff = t - sampleWindowMs;

        // Drop samples older than cutoff (safe + TS-friendly)
        while (samples.length > 0) {
            const first = samples[0];
            if (!first) break; // satisfies TS in edge/sparse cases
            if (first.t >= cutoff) break;
            samples.shift();
        }
    };

    // Velocity (px/sec) = distance between the oldest and newest sample over the
    // elapsed time between them. Needs at least two samples to have a span.
    const computeVelocityFromSamples = (): number => {
        if (samples.length < 2) return 0;

        const first = samples[0];
        const last = samples[samples.length - 1];

        // EXPLICIT GUARDS (this fixes TS errors)
        if (!first || !last) return 0;

        const dt = (last.t - first.t) / 1000;
        if (dt <= 0) return 0;

        return (last.y - first.y) / dt;
    };

    // On every scroll: flip status if the move is big enough, then refresh the
    // velocity reading from the rolling sample buffer.
    const onScroll = () => {
        const y = window.scrollY;
        const t = performance.now();
        const dy = y - lastScrollY;

        if (Math.abs(dy) >= flipThreshold) {
            const status: Status = dy > 0 ? "normal" : "inverted";
            marquee.setAttribute("data-marquee-status", status);
        }

        pushSample(y, t);
        rawVelocity = computeVelocityFromSamples();
        lastScrollEventTime = t;
        lastScrollY = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    // ── Per-frame loop (driven by the shared ticker) ────────────────────────
    const tick = (_time: number, deltaTime: number) => {
      // deltaTime is milliseconds since the last frame (from the shared ticker).
      // Convert to seconds and clamp so a long stall (tab blur) can't teleport
      // the marquee by a huge step.
      const dt = clamp(deltaTime / 1000, 0, 0.05);

      // If no scroll events have arrived recently, decay the velocity boost back
      // toward rest so the marquee eases down to its base speed.
      const now = performance.now();
      if (now - lastScrollEventTime > velocityTimeoutMs) {
        rawVelocity = lerp(rawVelocity, 0, 0.25);
      }

      // Ease the measured velocity, then map its magnitude to a 1–8× boost.
      smoothedVelocity = lerp(smoothedVelocity, rawVelocity, 0.15);

      const velocityMultiplier = clamp(
        Math.abs(smoothedVelocity) * 0.003 + 1,
        1,
        8
      );

      // Compose the final signed speed from: base × per-instance multiplier ×
      // scroll-velocity boost × direction × status (scroll-driven flip).
      const baseSpeed = readNumberAttr(marquee, "data-marquee-speed", 20);
      const scrollSpeedMul = readNumberAttr(scroll, "data-scroll-speed", 1);

      const direction = readEnumAttr<Direction>(
        marquee,
        "data-marquee-direction",
        ["left", "right"] as const,
        "left"
      );

      const status = readEnumAttr<Status>(
        marquee,
        "data-marquee-status",
        ["normal", "inverted"] as const,
        "normal"
      );

      const dirSign = direction === "left" ? -1 : 1;
      const statusSign = status === "normal" ? 1 : -1;

      const speed =
        baseSpeed * scrollSpeedMul * velocityMultiplier * dirSign * statusSign;

      // Advance and wrap. Whenever x passes a full track-width in either
      // direction, fold it back by that width so the offset stays bounded and
      // the two tracks tile seamlessly.
      if (trackWidth > 0) {
        x += speed * dt;

        if (x <= -trackWidth) x += trackWidth;
        if (x > 0) x -= trackWidth;

        const transform = `translate3d(${x}px, 0, 0)`;
        a.style.transform = transform;
        b.style.transform = transform;
      }
    };

    // add() returns its own disposer — call it to leave the shared loop.
    const stopRaf = add(tick);

    // ── Cleanup — drop every listener/observer and leave the shared loop ────
    onBeforeUnmount(() => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      resizeObs?.disconnect();
      stopRaf();
    });
  });
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE IN A VUE FILE
──────────────────────────────────────────────────────────────────────

This file lives in `composables/` so Nuxt 4 auto-imports it — no import
statement needed.

You provide four elements via refs:
  • marqueeEl — the root (carries the tuning data-attributes)
  • scrollEl  — wraps both tracks (gets position: relative)
  • trackA    — the content, rendered once
  • trackB    — an identical duplicate of trackA's content

<script setup lang="ts">
const marqueeEl = useTemplateRef<HTMLElement>('marqueeEl')
const scrollEl  = useTemplateRef<HTMLElement>('scrollEl')
const trackA    = useTemplateRef<HTMLElement>('trackA')
const trackB    = useTemplateRef<HTMLElement>('trackB')

// useMarquee wires its own onMounted / onBeforeUnmount — just call it in setup.
useMarquee(marqueeEl, scrollEl, trackA, trackB)
</script>

<template>
  <div
    ref="marqueeEl"
    class="marquee"
    data-marquee-speed="40"
    data-marquee-direction="left"
  >
    <div ref="scrollEl" class="marquee__scroll" data-scroll-speed="1">
      <div ref="trackA" class="marquee__track">Repeating headline —&nbsp;</div>
      <div ref="trackB" class="marquee__track">Repeating headline —&nbsp;</div>
    </div>
  </div>
</template>

CSS SETUP (required)
  The marquee needs to clip overflow, and the tracks must sit on one line so
  their measured width is correct.

  .marquee {
    overflow: hidden;
  }
  .marquee__scroll {
    display: flex;       // position: relative is set by the composable
    white-space: nowrap;
  }
  .marquee__track {
    flex: none;          // don't let flex shrink the measured width
    white-space: nowrap;
    will-change: transform;
  }

TUNING
  Speed / direction / scroll-reactivity are all controlled by the
  data-attributes documented on the composable above — set them right in the
  template, no JS changes needed. For example, a faster strip that runs to the
  right and reacts strongly to scrolling:

    data-marquee-speed="80" data-marquee-direction="right"

NOTE
  trackA and trackB must contain identical content for the loop to look
  seamless. Render the same markup twice (or v-for the same data into both).
──────────────────────────────────────────────────────────────────────
*/
