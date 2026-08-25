/**
 * The dashboard's navigation model and sidebar state.
 *
 * The item list lives here rather than in the layout so the sidebar, the mobile
 * drawer and the page-title lookup in the top bar all read from one array — a
 * tab added in one place turns up in all three.
 */
export interface DashboardNavItem {
	to: string;
	label: string;
	/** Inline SVG path data, drawn at 24×24 by NuxtDashboardIcon. */
	icon: string;
	/** Admin-only entries are filtered out for everyone else. */
	admin?: boolean;
	/**
	 * Draws a rule *above* this entry, splitting the list into groups. Sitting
	 * on the item rather than between two of them means a group whose opening
	 * entry is filtered out — an admin-only one, say — takes its rule with it,
	 * instead of leaving a divider hanging over nothing.
	 */
	group?: boolean;
}

export const dashboardNav: DashboardNavItem[] = [
	{ to: "/dashboard", label: "Overview", icon: "home" },
	{ to: "/dashboard/analytics", label: "Analytics", icon: "chart" },
	{ to: "/dashboard/sales", label: "Sales", icon: "tag" },
	{ to: "/dashboard/links", label: "Links & Assets", icon: "link" },
	// Account and help sit below the rule: the four above are the affiliate's
	// actual work, these are the things you visit once and leave again.
	{ to: "/dashboard/settings", label: "Settings", icon: "cog", group: true },
	{ to: "/dashboard/support", label: "Support", icon: "help" },
	{ to: "/dashboard/admin", label: "Admin", icon: "shield", admin: true },
];

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

	// The mobile drawer is deliberately *not* persisted — a drawer that is open
	// on arrival covers the page for no reason.
	const drawerOpen = useState<boolean>("ca-nav-drawer", () => false);

	const items = computed(() => dashboardNav.filter(item => !item.admin || isAdmin.value));

	return { items, collapsed, toggleCollapsed, drawerOpen };
}
