import { computed, reactive, ref } from "vue";
import { navigateTo, useRoute, useRouter } from "#imports";

/**
 * Login page state.
 *
 * Two modes on one route: signing in with a password, and redeeming a
 * one-time invite code to create an account. `?mode=redeem` opens the second.
 */

export type LoginMode = "login" | "redeem";

interface FieldErrors {
	[field: string]: string | undefined;
}

/** Pulls the offending field out of the API's 400 shape, if it named one. */
function fieldErrorFrom(error: unknown): { field?: string; message: string } {
	const data = (error as { data?: { data?: { field?: string; message?: string }; statusMessage?: string } })?.data;
	const statusMessage = data?.statusMessage;
	const inner = data?.data;

	return {
		field: inner?.field,
		message: statusMessage || "Something went wrong. Please try again.",
	};
}

export function useLogin() {
	const route = useRoute();
	const router = useRouter();

	const mode = ref<LoginMode>(route.query.mode === "redeem" ? "redeem" : "login");

	const form = reactive({
		email: "",
		password: "",
		code: "",
		emailConfirm: "",
		passwordConfirm: "",
	});

	const errors = ref<FieldErrors>({});
	const formError = ref<string | null>(null);
	const pending = ref(false);

	const setMode = (next: LoginMode) => {
		mode.value = next;
		errors.value = {};
		formError.value = null;
		// Keep the URL honest so a refresh stays on the same form.
		router.replace({ query: next === "redeem" ? { ...route.query, mode: "redeem" } : {} });
	};

	/** Where to land after a successful sign-in. */
	const destination = computed(() => {
		const next = route.query.next;
		// Only same-site paths: an absolute URL here would be an open redirect,
		// and this page is exactly where a phisher would want one.
		if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
			return next;
		}
		return "/dashboard";
	});

	async function submit() {
		if (pending.value) return;

		errors.value = {};
		formError.value = null;

		// Caught here rather than at the API so the mismatch is reported next to
		// the field instead of as a form-level failure.
		if (mode.value === "redeem") {
			if (form.email !== form.emailConfirm) {
				errors.value.emailConfirm = "Email addresses do not match";
				return;
			}
			if (form.password !== form.passwordConfirm) {
				errors.value.passwordConfirm = "Passwords do not match";
				return;
			}
		}

		pending.value = true;

		try {
			if (mode.value === "login") {
				await $fetch("/api/auth/login", {
					method: "POST",
					body: { email: form.email, password: form.password },
				});
			}
			else {
				await $fetch("/api/auth/redeem", {
					method: "POST",
					body: {
						code: form.code,
						email: form.email,
						emailConfirm: form.emailConfirm,
						password: form.password,
						passwordConfirm: form.passwordConfirm,
					},
				});
			}

			// Full reload rather than a client navigation: the session cookie is
			// httpOnly and the dashboard's first render should see it server-side.
			await navigateTo(destination.value, { external: true });
		}
		catch (error) {
			const { field, message } = fieldErrorFrom(error);
			if (field) errors.value[field] = message;
			else formError.value = message;
		}
		finally {
			pending.value = false;
		}
	}

	return { mode, setMode, form, errors, formError, pending, submit };
}
