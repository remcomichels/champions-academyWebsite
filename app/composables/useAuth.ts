export interface MeResponse {
	user: { isAdmin: boolean } | null;
	affiliate: {
		slug: string;
		displayName: string;
		avatarPath: string | null;
		timezone: string;
		locale: string;
	} | null;
}

/**
 * The signed-in user, shared across the dashboard.
 *
 * `/api/auth/me` answers 200 with nulls when signed out rather than 401, so
 * this can be called unconditionally — including from route middleware — with
 * no error handling for the ordinary logged-out case.
 */
export function useAuth() {
	const me = useState<MeResponse | null>("auth-me", () => null);

	const fetchMe = async (force = false): Promise<MeResponse> => {
		if (me.value && !force) return me.value;

		me.value = await $fetch<MeResponse>("/api/auth/me", {
			// The session cookie is httpOnly, so it has to be forwarded
			// explicitly when this runs during SSR.
			headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
		});

		return me.value;
	};

	const logout = async () => {
		await $fetch("/api/auth/logout", { method: "POST" });
		me.value = { user: null, affiliate: null };
		await navigateTo("/login");
	};

	return {
		me,
		fetchMe,
		logout,
		isSignedIn: computed(() => Boolean(me.value?.user)),
		isAdmin: computed(() => Boolean(me.value?.user?.isAdmin)),
		affiliate: computed(() => me.value?.affiliate ?? null),
	};
}
