import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

// ─────────────────────────────────────────────────────────────────────────────
// useAmethystSwitcher
//
// Drives the AI-panel switcher: which panel is active, the slide direction, and
// whether the auto-advance timer should be running. The timer itself is the CSS
// fill animation on the active tab — its `animationend` calls `onCycleEnd`, so
// visual progress and the actual switch can never drift apart. We only gate it
// on visibility here: `paused` is true whenever the block is off-screen, which
// freezes the fill (animation-play-state) and therefore the timer with it.
// ─────────────────────────────────────────────────────────────────────────────

interface UseAmethystSwitcherReturn {
	/** Index of the panel currently shown. */
	activeIndex: Ref<number>;
	/** 1 when advancing forward, -1 when going back — picks the slide direction. */
	direction: Ref<number>;
	/** True while the block is off-screen, so the fill/timer should hold. */
	paused: Ref<boolean>;
	/** Switch to a specific panel (tab click). */
	select: (index: number) => void;
	/** Advance to the next panel — called when the active tab's fill completes. */
	onCycleEnd: () => void;
}

export function useAmethystSwitcher(
	root: Ref<HTMLElement | null>,
	count: () => number,
): UseAmethystSwitcherReturn {
	const activeIndex = ref(0);
	const direction = ref(1);
	// Start paused: the fill only runs once the block scrolls into view.
	const paused = ref(true);

	let observer: IntersectionObserver | null = null;

	function select(index: number): void {
		const n = count();
		if (index < 0 || index >= n || index === activeIndex.value) return;
		direction.value = index > activeIndex.value ? 1 : -1;
		activeIndex.value = index;
	}

	function onCycleEnd(): void {
		const n = count();
		if (n < 2) return;
		direction.value = 1;
		activeIndex.value = (activeIndex.value + 1) % n;
	}

	onMounted(() => {
		observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry) paused.value = !entry.isIntersecting;
			},
			{ threshold: 0.25 },
		);
		if (root.value) observer.observe(root.value);
	});

	onBeforeUnmount(() => {
		observer?.disconnect();
		observer = null;
	});

	return { activeIndex, direction, paused, select, onCycleEnd };
}
