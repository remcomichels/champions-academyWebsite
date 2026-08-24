export type Theme = "dark" | "light";

const COOKIE = "ca_theme";

/**
 * Light/dark for the dashboard surfaces.
 *
 * Backed by a cookie rather than localStorage so the value is available during
 * SSR: the `data-theme` attribute is then already correct in the first byte of
 * HTML and there is no flash of the wrong theme on load. That is only safe
 * because every route that reads it (`/login`, `/dashboard/**`) is `no-store` —
 * putting this on a marketing page would make its cached HTML vary by cookie.
 *
 * The cookie is deliberately not httpOnly: the toggle writes it from the
 * browser, and a theme preference is not a secret.
 *
 * Shared through `useState` because each `useCookie()` call returns its own
 * ref — without this the toggle would update its own copy and the layout would
 * carry on rendering the old theme.
 */
export function useTheme() {
	const cookie = useCookie<Theme>(COOKIE, {
		default: () => "dark",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
		path: "/",
	});

	// Anything other than an exact "light" falls back to dark, so a hand-edited
	// or truncated cookie renders the default rather than an unstyled page.
	const theme = useState<Theme>("ca-theme", () => (cookie.value === "light" ? "light" : "dark"));

	const setTheme = (next: Theme) => {
		theme.value = next;
		cookie.value = next;
	};

	const toggle = () => setTheme(theme.value === "dark" ? "light" : "dark");

	return { theme, setTheme, toggle };
}
