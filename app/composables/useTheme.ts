/** What the affiliate picked. `system` is a preference, not a paintable value. */
export type ThemeChoice = "system" | "dark" | "light" | "classic";

/** What actually lands on `<html data-theme>`. `system` resolves to one of these. */
export type Theme = "dark" | "light" | "classic";

const COOKIE = "ca_theme";

export const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
	{ value: "system", label: "System" },
	{ value: "dark", label: "Dark" },
	{ value: "light", label: "Light" },
	{ value: "classic", label: "Classic dark" },
];

const CHOICES: ThemeChoice[] = ["system", "dark", "light", "classic"];

/**
 * Theme for the dashboard surfaces.
 *
 * Backed by a cookie rather than localStorage so the value is available during
 * SSR: the `data-theme` attribute is then already correct in the first byte of
 * HTML and there is no flash of the wrong theme on load. That is only safe
 * because every route that reads it (`/login`, `/dashboard/**`) is `no-store` —
 * putting this on a marketing page would make its cached HTML vary by cookie.
 *
 * The cookie is deliberately not httpOnly: the menu writes it from the browser,
 * and a theme preference is not a secret.
 *
 * ── The `system` problem ────────────────────────────────────────────────────
 * The other three are paintable server-side. `system` is not: the OS preference
 * lives behind `prefers-color-scheme`, which is a client-only media query, and
 * the request carries nothing that reveals it. So the cookie stores the
 * *choice*, and `resolved` is the choice with `system` collapsed to a real
 * theme.
 *
 * During SSR that collapse has to guess, and it guesses dark. A wrong guess for
 * a light-mode visitor would be a visible flash, which is what the inline script
 * in the dashboard layout's `useHead` exists to prevent — it corrects the
 * attribute during head parsing, before first paint and well ahead of
 * hydration. Without it the page would render dark and snap to light a moment
 * later.
 *
 * Shared through `useState` because each `useCookie()` call returns its own ref
 * — without this the menu would update its own copy and the layout would carry
 * on rendering the old theme.
 */
export function useTheme() {
	const cookie = useCookie<ThemeChoice>(COOKIE, {
		default: () => "system",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
		path: "/",
	});

	// Anything not on the list falls back to the default, so a hand-edited or
	// truncated cookie renders something rather than an unstyled page.
	const choice = useState<ThemeChoice>("ca-theme-choice", () =>
		CHOICES.includes(cookie.value) ? cookie.value : "system");

	/**
	 * What the OS asks for. Null until the client has looked — on the server
	 * there is nothing to look at.
	 */
	const systemPrefers = useState<Theme | null>("ca-theme-system", () => null);

	const resolved = computed<Theme>(() => {
		if (choice.value !== "system") return choice.value;
		return systemPrefers.value ?? "dark";
	});

	const setTheme = (next: ThemeChoice) => {
		choice.value = next;
		cookie.value = next;
	};

	if (import.meta.client) {
		const query = window.matchMedia("(prefers-color-scheme: light)");
		const read = () => { systemPrefers.value = query.matches ? "light" : "dark"; };

		read();
		// Tracks the OS switching mid-session — someone on a sunset schedule
		// should not have to reload to follow it.
		query.addEventListener("change", read);
	}

	return { choice, resolved, systemPrefers, setTheme, options: THEME_OPTIONS };
}
