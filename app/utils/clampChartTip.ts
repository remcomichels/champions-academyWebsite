// ─────────────────────────────────────────────────────────────────────────────
// clampChartTip
//
// Keeps a chart's hover readout inside its plot. Auto-imported by Nuxt
// (app/utils/), and used by the bar chart, the card sparklines and the heatmap
// so all three behave identically.
//
// The readout is centred on the mark it describes. Where centring would push it
// past the plot, it slides back just far enough to sit flush with the edge —
// which is the outer edge of the first or last mark, since the marks fill the
// plot. It never sits further out than that and never further in than it has
// to, so sweeping along a row moves it as little as possible.
//
// Why this is measured rather than written in CSS: the limit depends on how
// wide the text turns out. A percentage inside `translate()` resolves against
// the readout's own width, while the space it has to fit resolves against the
// plot's — two different bases, and CSS cannot compare them in one expression.
// The threshold-and-pin approach that stood here before was an approximation of
// this, and it broke exactly where the approximation did: a label wider than
// the few columns the threshold covered still hung off the card.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Horizontal correction, in px, to add to a centred readout.
 *
 * Returns 0 when the readout already fits, which is the common case — a shift
 * is only ever applied near the two ends of a plot.
 */
export function clampChartTip(
	tip: HTMLElement | null,
	anchor: HTMLElement | null,
	plot: HTMLElement | null,
): number {
	if (!tip || !anchor || !plot) return 0;

	const width = tip.offsetWidth;
	// Nothing has been laid out yet — measuring now would place it off a zero.
	if (!width) return 0;

	const anchorBox = anchor.getBoundingClientRect();
	const plotBox = plot.getBoundingClientRect();

	// A plot narrower than its own readout has no position that satisfies both
	// edges. Pinning to the start is the readable half of a bad choice: the
	// text runs off the end rather than beginning off-screen.
	if (plotBox.width <= width) return plotBox.left - (anchorBox.left + anchorBox.width / 2 - width / 2);

	const centred = anchorBox.left + anchorBox.width / 2 - width / 2;
	const clamped = Math.min(Math.max(centred, plotBox.left), plotBox.right - width);

	return clamped - centred;
}
