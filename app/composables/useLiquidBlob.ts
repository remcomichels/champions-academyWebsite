import type { Ref } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// useLiquidBlob
//
// The liquid reveal blob used by the benefit card grids. It's a chain of nodes:
// the head chases a target, each node chases the one ahead. Fast motion stretches
// the chain into a tail; slowing lets it pool back into a blob — that inertia is
// what reads as liquid (the CSS mask + gooey filter merge the nodes into one mass).
//
// The target is either the pointer (while the cursor is over the grid) or, with
// `autoWander`, a slow self-drifting path so the blob moves on its own.
//
// Each node is written to every card as --x{i}/--y{i}, relative to that card, so
// the mask's tapering circles line up across the gaps between cards. A
// `blob-active` class on the grid tells CSS when the blob should be visible.
// The RAF loop only runs while the grid is on-screen and actually needs to move.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LiquidBlobOptions {
  /**
   * Let the blob drift over the grid by itself when the pointer isn't on it.
   * `false` makes it hover-only: hidden until the cursor enters the grid.
   * Default: true.
   */
  autoWander?: boolean
  /** Selector for the cards inside the grid. Default: '.benefit-card'. */
  cardSelector?: string
  /** Number of nodes in the trail — more = longer tail. Default: 6. */
  trailLength?: number
}

interface UseLiquidBlobReturn {
  /** Call from onMounted — starts observing the grid. */
  initBlob: () => void
  /** Stop the RAF loop and disconnect the observer. Call from onUnmounted. */
  destroy: () => void
  /** Bind to the grid's @pointermove. */
  onPointerMove: (event: PointerEvent) => void
  /** Bind to the grid's @pointerleave. */
  onPointerLeave: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export function useLiquidBlob(
  grid: Ref<HTMLElement | null>,
  options: LiquidBlobOptions = {},
): UseLiquidBlobReturn {
  const {
    autoWander = true,
    cardSelector = '.benefit-card',
    trailLength = 6,
  } = options

  const { reduced } = useReducedMotion()

  let raf: number | null = null
  let io: IntersectionObserver | null = null
  let desktopHover: MediaQueryList | null = null
  let visible = false
  let following = false
  let seeded = false
  let t = 0
  const target = { x: 0, y: 0 }
  const trail = Array.from({ length: trailLength }, () => ({ x: 0, y: 0 }))

  function isDesktop(): boolean {
    desktopHover ??= window.matchMedia('(hover: hover) and (min-width: 1081px)')
    return desktopHover.matches
  }

  // Any hover-capable pointer. Mirrors the `(hover: none)` rule in
  // benefits_grid.less that hides the blob on touch.
  function hasHover(): boolean {
    return window.matchMedia('(hover: hover)').matches
  }

  // Move every trail node to a point at once — used when seeding so the blob
  // doesn't fly in from (0,0) on first appearance.
  function snapTo(x: number, y: number): void {
    target.x = x
    target.y = y
    trail.forEach((node) => { node.x = x; node.y = y })
  }

  // Autonomous target: two out-of-phase sines trace a loop within the grid, and
  // the drift speed itself breathes on a ~10s cycle — skewed to linger in the slow
  // (pooling) phase longer than the fast (stretching) one. The phase warp
  // (w + k·sin w) races through the peak and dwells at the trough, giving roughly
  // 4s fast / 6s slow so the liquid read stays lively instead of stale.
  function wander(rect: DOMRect): void {
    const w = (performance.now() / 10000) * Math.PI * 2
    const osc = Math.cos(w + 0.6 * Math.sin(w)) // 1 = fast, -1 = slow (lingers here)
    t += 0.0115 + osc * 0.0085 // 0.02 (stretch) ↔ 0.003 (pool)
    target.x = rect.left + rect.width / 2 + Math.sin(t * 1.1) * rect.width * 0.4
    target.y = rect.top + rect.height / 2 + Math.sin(t * 1.7 + 0.6) * rect.height * 0.4
  }

  function render(): void {
    const el = grid.value
    // Hover-only: once the pointer leaves there's nothing to animate, so let the
    // loop end (the blob fades out via CSS) instead of idling every frame.
    if (!el || !visible || (!autoWander && !following)) {
      raf = null
      return
    }

    if (!following) wander(el.getBoundingClientRect())

    // Head eases toward the target; each node eases toward the node ahead of it.
    // Looser factors let the chain lag apart into a longer, liquid tail.
    trail[0]!.x += (target.x - trail[0]!.x) * 0.18
    trail[0]!.y += (target.y - trail[0]!.y) * 0.18
    for (let i = 1; i < trailLength; i++) {
      trail[i]!.x += (trail[i - 1]!.x - trail[i]!.x) * 0.28
      trail[i]!.y += (trail[i - 1]!.y - trail[i]!.y) * 0.28
    }

    el.querySelectorAll<HTMLElement>(cardSelector).forEach((card) => {
      const r = card.getBoundingClientRect()
      for (let i = 0; i < trailLength; i++) {
        card.style.setProperty(`--x${i}`, `${trail[i]!.x - r.left}px`)
        card.style.setProperty(`--y${i}`, `${trail[i]!.y - r.top}px`)
      }
    })

    raf = requestAnimationFrame(render)
  }

  function start(): void {
    if (raf === null && visible && !reduced.value) raf = requestAnimationFrame(render)
  }

  function onPointerMove(event: PointerEvent): void {
    if (reduced.value) return
    // Auto-wander grids ignore the pointer below desktop (touch keeps drifting);
    // hover-only grids have nothing to show there at all.
    if (!isDesktop()) return

    if (!following) {
      // Entering a hover-only grid: start the trail at the cursor rather than
      // sweeping in from wherever it was left.
      if (!autoWander) snapTo(event.clientX, event.clientY)
      following = true
      grid.value?.classList.add('blob-active')
    }

    target.x = event.clientX
    target.y = event.clientY
    start()
  }

  function onPointerLeave(): void {
    following = false
    // Auto-wander picks the drift back up from where the pointer left it; a
    // hover-only blob fades out instead.
    if (!autoWander) grid.value?.classList.remove('blob-active')
    else start()
  }

  function initBlob(): void {
    const el = grid.value
    // No hover pointer means nothing can ever drive the trail, and CSS hides the
    // blob there — so skip the observer and RAF entirely rather than animating
    // an invisible element. An auto-wander grid would otherwise keep a loop
    // running on every phone, writing custom properties to every card.
    if (!el || reduced.value || !hasHover()) return

    io = new IntersectionObserver(
      (entries) => {
        visible = !!entries[0]?.isIntersecting
        if (!visible) return

        if (!seeded) {
          const r = el.getBoundingClientRect()
          snapTo(r.left + r.width / 2, r.top + r.height / 2)
          seeded = true
          // Auto-wander is visible from the moment it starts drifting; the
          // hover-only blob stays hidden until the pointer arrives.
          if (autoWander) el.classList.add('blob-active')
        }

        start()
      },
      { threshold: 0 },
    )
    io.observe(el)
  }

  function destroy(): void {
    if (raf !== null) cancelAnimationFrame(raf)
    raf = null
    io?.disconnect()
    io = null
  }

  return { initBlob, destroy, onPointerMove, onPointerLeave }
}


/*
──────────────────────────────────────────────────────────────────────
HOW TO USE
──────────────────────────────────────────────────────────────────────

Auto-imported by Nuxt — no import needed.

<script setup lang="ts">
const grid = useTemplateRef<HTMLElement>('grid')
const { initBlob, destroy, onPointerMove, onPointerLeave } = useLiquidBlob(grid, {
  autoWander: false,   // hover-only; omit (or true) to let it drift by itself
})

onMounted(() => initBlob())
onUnmounted(() => destroy())
</script>

<template>
  <div ref="grid" class="benefits-grid" @pointermove="onPointerMove" @pointerleave="onPointerLeave">
    <article class="benefit-card">…</article>
  </div>
</template>

The CSS side lives in assets/less/components/benefits_grid.less — the mask reads
--x0/--y0 … per card, and `.blob-active` on the grid fades the blob in.
──────────────────────────────────────────────────────────────────────
*/
