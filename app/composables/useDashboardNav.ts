/**
 * The dashboard's navigation model and sidebar state.
 *
 * There are two navigations, not one list with some entries filtered out. An
 * admin is two roles wearing one login — an affiliate with their own referral
 * figures, and the owner of everyone else's — and the two have nothing to say
 * to each other. Mixing them meant the rail grew admin destinations that were
 * meaningless in the middle of reading your own traffic, and the admin pages
 * sat below Support as an afterthought.
 *
 * `adminMode` swaps the whole rail instead, and is read off the URL rather than
 * stored — the mode is the section you are in. What it does not do is grant
 * anything: every /api/admin/* route re-checks requireAdmin, and the `admin`
 * route middleware still guards the pages. This decides what is drawn.
 */
export interface DashboardNavItem {
	to: string;
	label: string;
	/**
	 * A key into the dashboard's own icon set — see `NuxtDashboardIcon`.
	 *
	 * Optional because nothing forces an entry to carry one, though every entry
	 * currently does. The two main rails need theirs: they sit at @vw56 at rest,
	 * where the glyph is the only thing visible.
	 */
	icon?: string;
	/**
	 * Draws a rule *above* this entry, splitting the list into groups. Sitting
	 * on the item rather than between two of them means a group whose opening
	 * entry is dropped takes its rule with it, instead of leaving a divider
	 * hanging over nothing.
	 */
	group?: boolean;
	/**
	 * Names the group this entry opens, drawn above it and below any `group`
	 * rule. On the item for the same reason `group` is: the title belongs to the
	 * entries under it, so dropping the first one should take the title with it
	 * rather than leave it captioning the next group down.
	 */
	heading?: string;
}

/** An affiliate's own work, and only that. */
export const affiliateNav: DashboardNavItem[] = [
	{ to: "/dashboard", label: "Overview", icon: "home" },
	{ to: "/dashboard/analytics", label: "Analytics", icon: "chart" },
	// `sales`, not `tag`: the set draws one as a shopping bag and the other
	// as a price tag, and the note on `tag` is explicit that it means traffic.
	{ to: "/dashboard/sales", label: "Sales", icon: "sales" },
	{ to: "/dashboard/links", label: "Links & Assets", icon: "link" },
	// Account, Settings and Support all used to sit here, below a rule. They
	// are not places you work — you go, do one thing, and leave — so they live
	// in the top bar instead: the account pair in the profile menu, Support
	// behind the help glyph beside it. The rail is four destinations and no
	// divider, which is the whole of what an affiliate actually does here.
];

/**
 * The account area's own rail, which replaces the affiliate one while you are
 * inside it rather than nesting under it.
 *
 * Settings are not a place you work — they are somewhere you go, change one
 * thing, and leave. Keeping the main rail visible alongside them offers five
 * destinations that are all "stop doing this", which is why the sidebar here
 * swaps out entirely and offers one way back instead.
 */
export const accountNav: DashboardNavItem[] = [
	{ to: "/dashboard/account", label: "Preferences", icon: "cog", group: true, heading: "Account settings" },
	{ to: "/dashboard/account/security", label: "Security", icon: "shield" },
	{ to: "/dashboard/account/logs", label: "Audit Logs", icon: "history", group: true, heading: "Logs" },
];

/** Everything that reaches across affiliates rather than describing one. */
export const adminNav: DashboardNavItem[] = [
	{ to: "/dashboard/admin/analytics", label: "Analytics", icon: "chart" },
	{ to: "/dashboard/admin/affiliates", label: "Affiliates", icon: "shield" },
	{ to: "/dashboard/admin/activity", label: "Activity", icon: "history" },
	{ to: "/dashboard/admin/feedback", label: "Feedback", icon: "feedback" },
	{ to: "/dashboard/admin/changelog", label: "Changelog", icon: "changelog" },
];

/** Where the switch lands you. First entry, so reordering the rail moves it. */
export const ADMIN_HOME = adminNav[0]!.to;
export const AFFILIATE_HOME = affiliateNav[0]!.to;

/**
 * Reachable, but in no rail.
 *
 * Support left the sidebar for the top bar's help glyph. It still needs a label
 * here: `dashboardNav` is what resolves a path to the page's accessible
 * heading, and without an entry the support page's `<h1>` would read
 * "Dashboard" — the fallback that exists for routes nobody named.
 */
const unlistedNav: DashboardNavItem[] = [
	{ to: "/dashboard/support", label: "Support", icon: "help" },
];

/** Every set, for anything resolving a path to a label. */
export const dashboardNav: DashboardNavItem[] = [
	...affiliateNav,
	...adminNav,
	...accountNav,
	...unlistedNav,
];

/** True for any route the admin rail owns. */
export const isAdminRoute = (path: string) => path.startsWith("/dashboard/admin");

/** True for any route the account rail owns. */
export const isAccountRoute = (path: string) => path.startsWith("/dashboard/account");

/**
 * Which entry a path belongs to, by longest match.
 *
 * A plain `startsWith` cannot answer this: every dashboard path starts with
 * `/dashboard`, so Overview would claim all of them, and `/dashboard/account`
 * would claim Security and Audit Logs on top of its own page. Taking the
 * longest `to` that the path sits under settles both without either entry
 * needing to know the others exist.
 */
export function matchNavItem(path: string, items: DashboardNavItem[] = dashboardNav) {
	return items
		.filter(item => path === item.to || path.startsWith(`${item.to}/`))
		.sort((a, b) => b.to.length - a.to.length)[0] ?? null;
}

export function useDashboardNav() {
	const { isAdmin } = useAuth();

	// There is no pinned-open rail and so no width to remember. The `ca_nav`
	// cookie, the `ca-nav-collapsed` state and the toggle that wrote them are
	// gone with it: the rail has one resting width and peeks open under the
	// pointer, which is a CSS state that needs nothing on the server.

	const route = useRoute();

	/**
	 * Read off the URL rather than stored.
	 *
	 * The first version kept this in a cookie, which meant two sources of truth
	 * for one fact and every way of moving around the dashboard that is not the
	 * switch — a deep link, the back button, a redirect — could leave the admin
	 * rail drawn over an affiliate page. The mode *is* the section you are in,
	 * so there is nothing to keep in sync and nothing to seed on the server.
	 *
	 * Still gated on isAdmin: an affiliate who types the URL gets bounced by the
	 * route middleware, and should not see the admin rail on the way out.
	 */
	const inAdminMode = computed(() => isAdmin.value && isAdminRoute(route.path));

	/**
	 * Read off the URL for the same reason admin mode is, and not gated on a
	 * role: the account pages are every affiliate's own.
	 */
	const inAccountMode = computed(() => isAccountRoute(route.path));

	/** Switching modes is just going somewhere; the rail follows the route. */
	const setAdminMode = (on: boolean) => navigateTo(on ? ADMIN_HOME : AFFILIATE_HOME);

	// The mobile drawer is deliberately *not* persisted — a drawer that is open
	// on arrival covers the page for no reason.
	const drawerOpen = useState<boolean>("ca-nav-drawer", () => false);

	// Account first: an admin reading their own account settings is in the
	// account area, not the admin one, and `/dashboard/account` is not an admin
	// route anyway — so the two tests cannot both pass.
	const items = computed(() =>
		inAccountMode.value ? accountNav : inAdminMode.value ? adminNav : affiliateNav);

	return {
		items,
		drawerOpen,
		adminMode: inAdminMode,
		accountMode: inAccountMode,
		setAdminMode,
	};
}
