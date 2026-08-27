<template>
	<div class="feedback">
		<!-- A word rather than a glyph. A speech bubble beside a bell and a
		     question mark was three icons competing to be understood, and this
		     is the one of the three nobody would guess. -->
		<button
			type="button"
			class="dashBar-text"
			title="Report an issue or share an idea"
			@click="openDialog"
		>
			Feedback
		</button>

		<dialog ref="dialog" class="modal" @close="reset" @click="onBackdrop">
			<div class="modal-panel feedback-panel">
				<header class="modal-head">
					<h2 class="modal-title">
						{{ kind ? (kind === "issue" ? "Report an issue" : "Share an idea") : "What would you like to share?" }}
					</h2>
					<button type="button" class="modal-close" aria-label="Close" @click="closeDialog">
						<NuxtDashboardIcon name="close" />
					</button>
				</header>

				<!-- Step one. Two buttons rather than a select: there are exactly
				     two answers and picking one is also the thing that advances
				     the form, so a dropdown plus a Next would be two clicks for
				     what is genuinely one decision. -->
				<div v-if="!kind" class="feedback-choices">
					<button type="button" class="feedback-choice" @click="choose('issue')">
						<span class="feedback-choiceTitle">Issue</span>
						<span class="feedback-choiceNote">Something is broken, wrong, or confusing.</span>
					</button>

					<button type="button" class="feedback-choice" @click="choose('idea')">
						<span class="feedback-choiceTitle">Idea</span>
						<span class="feedback-choiceNote">Something you'd like the dashboard to do.</span>
					</button>
				</div>

				<!-- Step two. Same dialog, swapped contents. -->
				<form v-else class="feedback-form" novalidate @submit.prevent="submit">
					<label class="field-label" for="feedback-body">
						{{ kind === "issue" ? "What went wrong?" : "What's the idea?" }}
					</label>

					<textarea
						id="feedback-body"
						ref="body"
						v-model="text"
						class="field-input feedback-text"
						rows="6"
						:maxlength="MAX"
						:placeholder="kind === 'issue'
							? 'What were you doing, and what happened instead?'
							: 'What would you like to be able to do?'"
					/>

					<p class="feedback-meta">
						<span :class="{ 'is-over': remaining < 0 }">{{ remaining }}</span> characters left
					</p>

					<NuxtAlertBanner v-if="error" variant="error">{{ error }}</NuxtAlertBanner>

					<div class="feedback-actions">
						<button type="button" class="btn btn--ghost" @click="kind = null">Back</button>
						<button type="submit" class="btn btn--primary" :disabled="!canSend">
							{{ busy ? "Sending…" : "Send" }}
						</button>
					</div>
				</form>

				<p v-if="sent" class="feedback-sent" role="status">
					Thanks — that's with us. We read everything, but we won't reply here.
				</p>
			</div>
		</dialog>
	</div>
</template>

<script setup lang="ts">
/**
 * Feedback, from the top bar.
 *
 * Deliberately one-way. There is no thread, no status and no reply — this is a
 * suggestion box that lands in the admin dashboard for reading, and saying so
 * on send is what stops it being mistaken for support. Support is its own page,
 * and it is linked from the rail.
 */
type Kind = "issue" | "idea";

const MAX = 2000;

const dialog = ref<HTMLDialogElement | null>(null);
const body = ref<HTMLTextAreaElement | null>(null);

const kind = ref<Kind | null>(null);
const text = ref("");
const busy = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);

const remaining = computed(() => MAX - text.value.length);

const canSend = computed(() =>
	!busy.value && text.value.trim().length >= 3 && remaining.value >= 0);

const openDialog = () => {
	reset();
	dialog.value?.showModal();
};

const closeDialog = () => dialog.value?.close();

const reset = () => {
	kind.value = null;
	text.value = "";
	busy.value = false;
	sent.value = false;
	error.value = null;
};

const choose = async (next: Kind) => {
	kind.value = next;
	await nextTick();
	body.value?.focus();
};

/**
 * A click that lands on the dialog element itself came from the backdrop — the
 * visible card is `-panel`, so anything inside it hits that instead. Same trick
 * the admin edit dialog uses.
 */
const onBackdrop = (event: MouseEvent) => {
	if (event.target === dialog.value) closeDialog();
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
		setTimeout(() => { if (sent.value) closeDialog(); }, 2200);
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
</script>
