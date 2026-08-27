export interface MeResponse {
	user: { isAdmin: boolean } | null;
	affiliate: {
		slug: string;
		displayName: string;
		avatarPath: string | null;
		timezone: string;
		locale: string;
		/** Shown under the name in the profile menu. Not editable here. */
		email: string | null;
	} | null;
	/** Set while an admin is viewing this affiliate rather than being them. */
	viewingAs: { slug: string; displayName: string; status: string } | null;
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
		me.value = { user: null, affiliate: null, viewingAs: null };
		await navigateTo("/login");
	};

	return {
		me,
		fetchMe,
		logout,
		isSignedIn: computed(() => Boolean(me.value?.user)),
		isAdmin: computed(() => Boolean(me.value?.user?.isAdmin)),
		affiliate: computed(() => me.value?.affiliate ?? null),
		viewingAs: computed(() => me.value?.viewingAs ?? null),

		/**
		 * Leaves view-as and reloads. A full reload rather than a refetch: every
		 * page in the dashboard has already fetched its data as the affiliate
		 * being viewed, and there is no cheap way to invalidate all of it.
		 */
		stopViewingAs: async () => {
			await $fetch("/api/admin/view-as", { method: "DELETE" });
			await navigateTo("/dashboard/admin/affiliates", { external: true });
		},
	};
}
