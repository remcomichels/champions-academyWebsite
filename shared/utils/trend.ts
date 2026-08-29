export interface Trend {
	direction: "up" | "down" | "flat";
	/** Short label shown under the figure, e.g. "14% vs last month". */
	text: string;
}

/**
 * Period-over-period change for a stat tile.
 *
 * Returns null rather than a misleading figure whenever a percentage would be
 * dishonest — there is no meaningful "percent change" from zero, and a tile
 * with no history should say nothing rather than imply a trend.
 */
export function trend(current: number, previous: number, period: string): Trend | null {
	if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;

	// Nothing then, nothing now — an arrow here would be noise.
	if (previous === 0 && current === 0) return null;

	// Growth from zero is undefined, not infinite. Say what actually happened,
	// in wording that suits any metric — this helper is shared by the visit,
	// session and country tiles.
	if (previous === 0) {
		return { direction: "up", text: `Up from zero ${period}` };
	}

	const change = ((current - previous) / previous) * 100;

	// Rounded before comparing, so a change that displays as 0% is labelled flat
	// rather than shown with an arrow that contradicts the number beside it.
	const rounded = Math.round(change);

	if (rounded === 0) return { direction: "flat", text: `No change ${period}` };

	return {
		direction: rounded > 0 ? "up" : "down",
		text: `${Math.abs(rounded)}% ${period}`,
	};
}
