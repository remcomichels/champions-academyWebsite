import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { createAvatar } from "@bible-strong/avatar-web";
import type { AnimationKey, AvatarController, AvatarDefinition } from "@bible-strong/avatar-web";

/**
 * Mounts a Bible Strong procedural avatar into a host element.
 *
 * The definition is fetched rather than `import`ed from JSON on purpose. A
 * static import would make a missing or malformed definition a *build* failure,
 * and this thing is decoration on a page whose actual job is signing people in
 * — a bad avatar file must never be able to take the login form down with it.
 * Fetching keeps the failure at runtime and local to the left-hand column,
 * where `status` turns into the fallback slot.
 */

export type AvatarStatus = "loading" | "ready" | "error";

interface UseAvatarOptions {
	/** Path to the `.avatar.json`, served from `public/`. */
	definitionUrl: string;
	/** Key of the animation to autoplay, as named in the definition. */
	animation?: string;
	/** CSS width and height handed to the renderer's own container. */
	size?: number | string;
	ariaLabel?: string;
	/** `#rrggbb`, or the name of a custom property to read it from. */
	bodyColor?: string;
}

/**
 * Turns a colour prop into something the definition validator will accept.
 *
 * Takes a custom property name as well as a literal so the brand purple stays
 * declared once, in dashboardTokens.less, instead of being re-typed as a hex
 * here where nothing would keep the two in step.
 *
 * Anything that is not `#rrggbb` after normalising is dropped rather than
 * passed through: the validator rejects the whole definition over one bad
 * colour, and losing the tint is a far better outcome than losing the avatar.
 */
function resolveBodyColor(raw: string | undefined, host: HTMLElement): string | undefined {
	if (!raw) return undefined;

	// getComputedStyle returns a custom property as its raw token text — with
	// the leading space from the declaration still attached — so this is the
	// one place the trim actually matters.
	const value = raw.startsWith("--")
		? getComputedStyle(host).getPropertyValue(raw)
		: raw;

	const hex = value.trim().toLowerCase();
	return /^#[0-9a-f]{6}$/.test(hex) ? hex : undefined;
}

export function useAvatar(options: UseAvatarOptions) {
	const host = ref<HTMLElement | null>(null);
	const status = ref<AvatarStatus>("loading");

	// shallowRef, not ref: the controller closes over a live SVG tree and a
	// requestAnimationFrame loop. Deep reactivity would walk all of it on every
	// assignment for no benefit.
	const controller = shallowRef<AvatarController | null>(null);

	// The fetch is async, so the component can be gone by the time it lands.
	// Without this the renderer starts a RAF loop against a detached node that
	// nothing will ever destroy.
	let disposed = false;

	onMounted(async () => {
		try {
			const definition = await $fetch<AvatarDefinition>(options.definitionUrl, {
				// It is a static file, not an API: skip the base URL and Nuxt's
				// payload handling and just read it.
				responseType: "json",
			});

			if (disposed || !host.value) return;

			const bodyColor = resolveBodyColor(options.bodyColor, host.value);

			// Copied, not mutated: the fetched object is the shape the renderer
			// validates, and a definition edited in place would drift from the
			// file on disk with nothing to show for it.
			//
			// This only reaches the top-level colour. Two expressions in the
			// Cloudee export carry their own (`angry-brows` red, `uneasy-left`
			// blue) and still will — that is the point of them, and neither is
			// a step in the animation this page plays.
			const tinted = bodyColor
				? { ...definition, colors: { ...definition.colors, body: bodyColor } }
				: definition;

			controller.value = createAvatar(host.value, {
				definition: tinted,
				defaultAnimation: options.animation as AnimationKey | undefined,
				size: options.size ?? "100%",
				ariaLabel: options.ariaLabel,
				// A key that is not in the definition resolves to an error rather
				// than a throw, so it has to be surfaced explicitly or the avatar
				// just sits there in neutral with no clue why.
				onError: (error) => {
					console.warn(`[avatar] ${error.code}: ${error.key}`);
				},
			});

			status.value = "ready";
		}
		catch (error) {
			// Not fatal, and not worth an error banner on a sign-in screen. The
			// column falls back to its static content and the form is untouched.
			console.warn("[avatar] could not be mounted", error);
			status.value = "error";
		}
	});

	// Cleanup is not optional: destroy() is what cancels the scheduled frame.
	// Skipping it leaks a RAF loop per visit to this page, silently.
	onBeforeUnmount(() => {
		disposed = true;
		controller.value?.destroy();
		controller.value = null;
	});

	return { host, status, controller };
}
