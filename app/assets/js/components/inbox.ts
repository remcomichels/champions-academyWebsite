import { ref, computed, onMounted, onUnmounted, type Ref } from "vue";

/**
 * Activity inbox and live sale toasts.
 *
 * Listens on /api/affiliate/stream (server-sent events). EventSource is used
 * rather than a WebSocket because the traffic is one-way and it reconnects by
 * itself — which matters, since the server deliberately closes the stream
 * before the platform's streaming limit would.
 */

export interface InboxItem {
	id: number;
	kind: string;
	payload: Record<string, unknown>;
	read: boolean;
	createdAt: string;
}

/** How long a toast stays on screen. */
const TOAST_MS = 8000;

export function useInbox() {
	const open = ref(false);
	/** The panel and its trigger, so a click can be tested against both. */
	const root = ref<HTMLElement | null>(null);
	const items = ref<InboxItem[]>([]);
	const unread = ref(0);
	const toasts = ref<InboxItem[]>([]);

	let source: EventSource | null = null;
	const timers: ReturnType<typeof setTimeout>[] = [];

	async function load() {
		try {
			const data = await $fetch<{ items: InboxItem[]; unread: number }>("/api/affiliate/notifications");
			items.value = data.items;
			unread.value = data.unread;
		}
		catch {
			// An inbox that cannot load must not take the dashboard down with it.
		}
	}

	async function toggle() {
		open.value = !open.value;

		if (open.value) {
			await load();

			if (unread.value > 0) {
				unread.value = 0;
				try {
					await $fetch("/api/affiliate/notifications-read", { method: "POST" });
					items.value = items.value.map(item => ({ ...item, read: true }));
				}
				catch {
					// Cosmetic only — the badge reappears on the next load.
				}
			}
		}
	}

	function showToast(item: InboxItem) {
		toasts.value = [...toasts.value, item];
		timers.push(setTimeout(() => {
			toasts.value = toasts.value.filter(t => t.id !== item.id);
		}, TOAST_MS));
	}

	function describe(item: InboxItem): string {
		if (item.kind === "sale") {
			const buyer = item.payload?.buyerUsername;
			return typeof buyer === "string" && buyer
				? `New sale — ${buyer} joined through your link`
				: "New sale through your link";
		}
		return "Activity on your account";
	}

	function formatWhen(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const minutes = Math.round(diff / 60000);
		if (minutes < 1) return "just now";
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
	}

	/**
	 * Anything outside the bell and its panel closes it.
	 *
	 * On `pointerdown` rather than `click`: a click only lands once the button
	 * is released, so pressing down on a link outside left the panel open for
	 * the whole press. Capture phase for the same reason a modal uses it — a
	 * handler inside the page that calls `stopPropagation` should not be able
	 * to strand the panel open.
	 */
	function onPointerDown(event: PointerEvent) {
		if (!open.value) return;

		const target = event.target as Node | null;
		if (target && root.value?.contains(target)) return;

		open.value = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== "Escape" || !open.value) return;

		open.value = false;
		// Focus goes back to the bell rather than being left on whatever the
		// panel contained, which is where it was before the panel opened.
		root.value?.querySelector<HTMLButtonElement>(".inbox-trigger")?.focus();
	}

	onMounted(() => {
		void load();

		document.addEventListener("pointerdown", onPointerDown, true);
		document.addEventListener("keydown", onKeydown);

		source = new EventSource("/api/affiliate/stream");

		source.addEventListener("sale", (message) => {
			try {
				const item = JSON.parse((message as MessageEvent).data) as InboxItem;
				unread.value += 1;
				items.value = [item, ...items.value];
				showToast(item);
			}
			catch {
				// A malformed frame is not worth breaking the page over.
			}
		});

		// EventSource retries on its own; nothing to do but avoid noisy logging.
		source.onerror = () => {};
	});

	onUnmounted(() => {
		document.removeEventListener("pointerdown", onPointerDown, true);
		document.removeEventListener("keydown", onKeydown);

		source?.close();
		source = null;
		timers.forEach(clearTimeout);
	});

	return {
		open,
		root: root as Ref<HTMLElement | null>,
		toggle,
		items: computed(() => items.value),
		unread: computed(() => unread.value),
		toasts: computed(() => toasts.value),
		describe,
		formatWhen,
	};
}
