<template>
	<div ref="root" class="feedback">
		<!-- A word rather than a glyph. A speech bubble beside a bell and a
		     question mark was three icons competing to be understood, and this
		     is the one of the three nobody would guess. -->
		<button
			type="button"
			class="dashBar-text tip"
			data-tip="Report an issue or share an idea"
			:aria-expanded="open"
			aria-haspopup="dialog"
			@click="toggle"
		>
			Feedback
		</button>

		<!-- A panel under the button, matching the account menu, rather than a
		     modal over the page. Sending feedback is a small aside — dimming
		     the dashboard and trapping focus for it framed a two-click errand
		     as an interruption. -->
		<div v-if="open" class="feedbackPanel" role="dialog" :aria-label="heading">
			<p class="feedbackPanel-title">{{ heading }}</p>

			<!-- Step one: two targets, and picking one is also what advances the
			     form — so a select plus a Next would be two actions for what is
			     genuinely one decision. -->
			<div v-if="!kind" class="feedbackPanel-choices">
				<button
					v-for="option in options"
					:key="option.value"
					type="button"
					class="feedbackCard"
					:class="`is-${option.value}`"
					@click="choose(option.value)"
				>
					<Icon :name="option.icon" class="feedbackCard-icon" />
					<span class="feedbackCard-label">{{ option.label }}</span>
					<span class="feedbackCard-note">{{ option.note }}</span>
				</button>
			</div>

			<!-- Step two: same panel, swapped contents. -->
			<form v-else class="feedbackPanel-form" novalidate @submit.prevent="submit">
				<textarea
					id="feedback-body"
					ref="body"
					v-model="text"
					class="field-input feedbackPanel-text"
					rows="5"
					:maxlength="MAX"
					:placeholder="kind === 'issue'
						? 'What were you doing, and what happened instead?'
						: 'What would you like to be able to do?'"
				/>

				<p class="feedbackPanel-meta">
					<span :class="{ 'is-over': remaining < 0 }">{{ remaining }}</span> left
				</p>

				<NuxtAlertBanner v-if="error" variant="error">{{ error }}</NuxtAlertBanner>

				<div class="feedbackPanel-actions">
					<button type="button" class="btn btn--ghost" @click="kind = null">Back</button>
					<button type="submit" class="btn btn--primary" :disabled="!canSend">
						{{ busy ? "Sending…" : "Send" }}
					</button>
				</div>
			</form>

			<p v-if="sent" class="feedbackPanel-sent" role="status">
				Thanks — that's with us. We read everything, but we won't reply here.
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * Feedback, from the top bar.
 *
 * Deliberately one-way. There is no thread, no status and no reply — this is a
 * suggestion box that lands in the admin dashboard for reading, and saying so
 * on send is what stops it being mistaken for support. Support is its own page,
 * and it is linked from the rail beside this.
 */
type Kind = "issue" | "idea";

const MAX = 2000;

const options = [
	{
		value: "issue" as const,
		label: "Issue",
		note: "with my account",
		icon: "material-symbols-light:warning-outline-rounded",
	},
	{
		value: "idea" as const,
		label: "Idea",
		note: "to improve the dashboard",
		icon: "material-symbols-light:lightbulb-2-outline-rounded",
	},
];

const root = ref<HTMLElement | null>(null);
const body = ref<HTMLTextAreaElement | null>(null);

const open = ref(false);
const kind = ref<Kind | null>(null);
const text = ref("");
const busy = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);

const heading = computed(() => {
	if (sent.value) return "Thanks";
	if (!kind.value) return "What would you like to share?";
	return kind.value === "issue" ? "Report an issue" : "Share an idea";
});

const remaining = computed(() => MAX - text.value.length);

const canSend = computed(() =>
	!busy.value && text.value.trim().length >= 3 && remaining.value >= 0);

const reset = () => {
	kind.value = null;
	text.value = "";
	busy.value = false;
	sent.value = false;
	error.value = null;
};

const close = () => { open.value = false; };

const toggle = () => {
	if (open.value) { close(); return; }

	reset();
	open.value = true;
};

const choose = async (next: Kind) => {
	kind.value = next;
	await nextTick();
	body.value?.focus();
};

const submit = async () => {
	if (!canSend.value || !kind.value) return;

	busy.value = true;
	error.value = null;

	try {
		await $fetch("/api/affiliate/feedback", {
			method: "POST",
			body: { kind: kind.value, body: text.value.trim() },
		});

		sent.value = true;
		kind.value = null;
		text.value = "";

		// Long enough to read the confirmation, short enough not to feel stuck.
		setTimeout(() => { if (sent.value) close(); }, 2200);
	}
	catch (cause) {
		const status = (cause as { statusCode?: number }).statusCode;
		error.value = status === 429
			? "That's a lot of feedback in one go — try again in a few minutes."
			: "That didn't send. Try again in a moment.";
	}
	finally {
		busy.value = false;
	}
};

// Click-outside and Escape, bound only while open — the same handling the
// account menu uses, so the two panels behave identically.
watch(open, (isOpen) => {
	if (!import.meta.client) return;

	const onPointer = (event: PointerEvent) => {
		if (!root.value?.contains(event.target as Node)) close();
	};

	const onKey = (event: KeyboardEvent) => {
		if (event.key === "Escape") close();
	};

	if (isOpen) {
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		cleanup = () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}
	else {
		cleanup?.();
		cleanup = null;
	}
});

let cleanup: (() => void) | null = null;

// Navigating away from under an open panel leaves it open over the new page.
const route = useRoute();
watch(() => route.fullPath, close);

onUnmounted(() => cleanup?.());
</script>
