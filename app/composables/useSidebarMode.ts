/** How the rail behaves at rest. */
export type SidebarMode = "hover" | "expanded" | "collapsed";

const COOKIE = "ca_sidebar";

export const SIDEBAR_OPTIONS: { value: SidebarMode; label: string }[] = [
	{ value: "hover", label: "Expand on hover" },
	{ value: "expanded", label: "Expanded" },
	{ value: "collapsed", label: "Collapsed" },
];

const MODES: SidebarMode[] = ["hover", "expanded", "collapsed"];

/**
 * Rail behaviour for the dashboard.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 * The rail had a pinned-open state once and it was deliberately removed: the
 * note on `.dashNav` says a rail that can be latched open "has to shove the
 * page column across to make room for itself, which is a lot of machinery for
 * a width nobody sets twice". That was right when the width was ours to choose
 * — peeking is the better default, and it still is. It stops being right the
 * moment the width is the affiliate's to choose, which is what this is.
 *
 * The machinery turned out to be one line either way. `.dashLayout` already
 * declares `--rail-shut` and `--rail-open`, the rail reads the first for its
 * width and the column reads it for its offset, so moving that one variable
 * moves both and they cannot disagree — exactly the mechanism the account rail
 * has always used to stay open.
 *
 * Backed by a cookie for the same reason the theme is: the value has to be
 * known during SSR or the rail renders at one width and jumps to another on
 * hydration, which is a layout shift on every page load. Safe only because
 * every route that reads it is `no-store`.
 *
 * Shared through `useState` because each `useCookie()` call returns its own
 * ref — without it the settings page would update its copy and the layout
 * would carry on drawing the old width.
 */
export function useSidebarMode() {
	const cookie = useCookie<SidebarMode>(COOKIE, {
		default: () => "hover",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
		path: "/",
	});

	// Anything not on the list falls back to the default, so a hand-edited or
	// truncated cookie renders a usable rail rather than a broken one.
	const mode = useState<SidebarMode>("ca-sidebar-mode", () =>
		MODES.includes(cookie.value) ? cookie.value : "hover");

	const setSidebarMode = (next: SidebarMode) => {
		mode.value = next;
		cookie.value = next;
	};

	return { mode, setSidebarMode, options: SIDEBAR_OPTIONS };
}
