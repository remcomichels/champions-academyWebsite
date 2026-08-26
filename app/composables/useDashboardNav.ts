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
	/** Inline SVG path data, drawn at 24×24 by NuxtDashboardIcon. */
	icon: string;
	/**
	 * Draws a rule *above* this entry, splitting the list into groups. Sitting
	 * on the item rather than between two of them means a group whose opening
	 * entry is dropped takes its rule with it, instead of leaving a divider
	 * hanging over nothing.
	 */
	group?: boolean;
}

/** An affiliate's own work, then the pages you visit once and leave again. */
export const affiliateNav: DashboardNavItem[] = [
	{ to: "/dashboard", label: "Overview", icon: "home" },
	{ to: "/dashboard/analytics", label: "Analytics", icon: "chart" },
	{ to: "/dashboard/sales", label: "Sales", icon: "tag" },
	{ to: "/dashboard/links", label: "Links & Assets", icon: "link" },
	{ to: "/dashboard/settings", label: "Settings", icon: "cog", group: true },
	{ to: "/dashboard/support", label: "Support", icon: "help" },
];

/** Everything that reaches across affiliates rather than describing one. */
export const adminNav: DashboardNavItem[] = [
	{ to: "/dashboard/admin/affiliates", label: "Affiliates", icon: "shield" },
	{ to: "/dashboard/admin/activity", label: "Activity", icon: "history" },
];

/** Where the switch lands you. First entry, so reordering the rail moves it. */
export const ADMIN_HOME = adminNav[0]!.to;
export const AFFILIATE_HOME = affiliateNav[0]!.to;

/** Both sets, for anything resolving a path to a label. */
export const dashboardNav: DashboardNavItem[] = [...affiliateNav, ...adminNav];

/** True for any route the admin rail owns. */
export const isAdminRoute = (path: string) => path.startsWith("/dashboard/admin");

const COOKIE = "ca_nav";

export function useDashboardNav() {
	const { isAdmin } = useAuth();

	// Cookie-backed for the same reason as the theme: the collapsed rail is a
	// different width, so reading it only on the client would render the
	// expanded sidebar first and then snap narrower after hydration.
	const cookie = useCookie<"open" | "closed">(COOKIE, {
		default: () => "open",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
		path: "/",
	});

	const collapsed = useState<boolean>("ca-nav-collapsed", () => cookie.value === "closed");

	const toggleCollapsed = () => {
		collapsed.value = !collapsed.value;
		cookie.value = collapsed.value ? "closed" : "open";
	};

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

	/** Switching modes is just going somewhere; the rail follows the route. */
	const setAdminMode = (on: boolean) => navigateTo(on ? ADMIN_HOME : AFFILIATE_HOME);

	// The mobile drawer is deliberately *not* persisted — a drawer that is open
	// on arrival covers the page for no reason.
	const drawerOpen = useState<boolean>("ca-nav-drawer", () => false);

	const items = computed(() => (inAdminMode.value ? adminNav : affiliateNav));

	return {
		items,
		collapsed,
		toggleCollapsed,
		drawerOpen,
		adminMode: inAdminMode,
		setAdminMode,
	};
}
