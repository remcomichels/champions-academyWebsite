<template>
	<div class="dashSection adminChangelog">
		<header class="dashHead">
			<h2 class="dashHead-title">Changelog</h2>

			<!-- The one thing this page is for, top right where the list's own
			     controls are not. Writing an entry used to be a form sitting
			     permanently above the list, which gave a page whose usual job is
			     reading a large empty box to scroll past. -->
			<button type="button" class="btn btn--primary" @click="openCreate">
				<NuxtDashboardIcon name="plus" />
				New entry
			</button>
		</header>

		<!-- Bottom right rather than a banner above the list: a banner pushed
		     everything down the moment it appeared, and reported the result of a
		     save that had scrolled out of view. Same control the settings column
		     uses, for the same reason. -->
		<NuxtDashboardToast :message="toast?.text ?? ''" :variant="toast?.variant ?? 'info'">
			{{ toast?.text }}
		</NuxtDashboardToast>

		<NuxtAlertBanner v-if="error" variant="error">
			The changelog didn't load. Try again in a moment.
		</NuxtAlertBanner>

		<p v-else-if="pending" class="dash-loading">Loading…</p>

		<p v-else-if="!entries.length" class="dashPanel-empty">
			Nothing written yet. New entry starts the first one.
		</p>

		<ol v-else class="changelog">
			<li
				v-for="entry in entries"
				:key="entry.id"
				class="changelog-entry"
				:class="{ 'is-draft': !entry.published }"
			>
				<!-- The date column says what state the entry is in as well as
				     when it went out — a draft has no publication date, and an
				     empty cell there would say nothing at all. -->
				<p class="changelog-when">
					<time v-if="entry.at" :datetime="entry.at">{{ formatDate(entry.at) }}</time>
					<span v-else class="changelog-draft">Draft</span>
				</p>

				<div class="changelog-copy">
					<h3 class="changelog-title">{{ entry.title }}</h3>
					<span class="changelog-kind" :class="`is-${entry.kind}`">
						{{ CHANGELOG_LABELS[entry.kind] }}
					</span>
					<p class="changelog-body">{{ entry.body }}</p>
				</div>

				<div class="changelog-actions">
					<button
						type="button"
						class="iconButton tip"
						data-tip="Edit"
						:aria-label="`Edit ${entry.title}`"
						@click="openEdit(entry)"
					>
						<NuxtDashboardIcon name="edit" />
					</button>

					<button
						type="button"
						class="iconButton iconButton--danger tip"
						data-tip="Delete"
						:aria-label="`Delete ${entry.title}`"
						@click="confirming = entry"
					>
						<NuxtDashboardIcon name="trash" />
					</button>
				</div>
			</li>
		</ol>

		<!-- One dialog for both writing and correcting. They ask for exactly the
		     same three things, and a second copy of the form would be a second
		     place for the field list to drift. -->
		<dialog
			ref="editorDialog"
			class="modal modal--compact modal--changelog"
			@close="onEditorClose"
			@click="onEditorClick"
		>
			<form class="modal-panel" novalidate @submit.prevent="save(submitAction)">
				<header class="modal-head">
					<h2 class="modal-title">{{ editing ? "Edit entry" : "Write an entry" }}</h2>
					<button type="button" class="modal-close" aria-label="Close" @click="closeEditor">
						<NuxtDashboardIcon name="close" />
					</button>
				</header>

				<!-- `data-lenis-prevent` here and on the textarea below. Lenis is
				     a global plugin with no route gating: it intercepts the
				     wheel across the whole app and scrolls the page with it, so
				     an inner scroller gets nothing unless it opts out — and
				     while a dialog is open `useScrollLock` has stopped the page
				     as well, which is why the wheel appeared to do nothing at
				     all rather than scrolling the wrong thing. -->
				<div class="modal-body" data-lenis-prevent>
					<NuxtAuthField
						v-model="form.title"
						label="Title"
						placeholder="What shipped, in a few words"
						:error="errors.title"
						:disabled="Boolean(busy)"
						required
					/>

					<!-- Required, and pre-set to the most common of the four
					     rather than to a blank "choose one" row. A picker that
					     starts empty is a second required field. -->
					<NuxtDashboardSelectField
						:model-value="form.kind"
						:options="kindOptions"
						label="Kind"
						hint="Shown as the pill on the public changelog."
						:disabled="Boolean(busy)"
						@update:model-value="form.kind = $event as ChangelogKind"
					/>

					<div class="field">
						<label class="field-label" for="changelog-body">What changed</label>
						<textarea
							id="changelog-body"
							v-model="form.body"
							class="field-input adminChangelog-text"
							rows="6"
							data-lenis-prevent
							:maxlength="8000"
							:disabled="Boolean(busy)"
							placeholder="A line or two on what's new. Line breaks are kept."
						/>
						<p v-if="errors.body" class="field-message is-error">{{ errors.body }}</p>
					</div>
				</div>

				<footer class="modal-foot">
					<button type="button" class="btn btn--ghost" :disabled="Boolean(busy)" @click="closeEditor">
						Cancel
					</button>

					<!-- What the second button offers depends on where the entry
					     already is. A published entry cannot be "saved as a
					     draft" — that is not a save, it is taking it off the
					     website — so it is named for what it does. -->
					<button
						v-if="editing?.published"
						type="button"
						class="btn btn--subtle"
						:disabled="Boolean(busy)"
						@click="save('draft')"
					>
						{{ busy === "draft" ? "Saving…" : "Unpublish" }}
					</button>

					<button
						v-else
						type="button"
						class="btn btn--subtle"
						:disabled="Boolean(busy)"
						@click="save('draft')"
					>
						{{ busy === "draft" ? "Saving…" : "Save as draft" }}
					</button>

					<button type="submit" class="btn btn--primary" :disabled="Boolean(busy)">
						{{ submitLabel }}
					</button>
				</footer>
			</form>
		</dialog>

		<!-- A dialog rather than window.confirm, for the reason the deletion
		     dialog on Preferences gives: a confirm cannot carry the title of the
		     thing it is about, and looks like the browser asking rather than us. -->
		<dialog
			ref="confirmDialog"
			class="modal modal--compact modal--changelog"
			@close="onConfirmClose"
			@click="onConfirmClick"
		>
			<div class="modal-panel">
				<header class="modal-head">
					<h2 class="modal-title">Delete this entry?</h2>
					<button type="button" class="modal-close" aria-label="Close" @click="confirming = null">
						<NuxtDashboardIcon name="close" />
					</button>
				</header>

				<div class="modal-body">
					<p class="modal-warning">
						<strong>{{ confirming?.title }}</strong> is removed for good.
						<template v-if="confirming?.published">
							It is on the public changelog now, and will be gone from it as soon as
							the page is next served.
						</template>
						<template v-else>
							It is a draft, so nobody has seen it.
						</template>
						There is no undo.
					</p>
				</div>

				<footer class="modal-foot">
					<button type="button" class="btn btn--ghost" :disabled="Boolean(busy)" @click="confirming = null">
						Cancel
					</button>
					<button type="button" class="btn btn--danger" :disabled="Boolean(busy)" @click="remove">
						{{ busy === "delete" ? "Deleting…" : "Delete entry" }}
					</button>
				</footer>
			</div>
		</dialog>
	</div>
</template>

<script setup lang="ts">
/**
 * Where release notes are written, corrected and taken down.
 *
 * It was append-only until the changelog became a public page. That reasoning —
 * a changelog is a record, and quietly rewriting one defeats the point of
 * keeping it — held while the only readers were signed in. It does not survive
 * a typo being on the website: the cost of a mistake went up, and the honest
 * answer is an audit row for every edit and deletion rather than no edit button.
 *
 * The list is every entry, drafts included. Drafts were invisible here before,
 * which made Save as draft a way to write something nobody could ever publish.
 */
import type { AdminChangelogEntry, ChangelogKind } from "#shared/types/changelog";
import { CHANGELOG_KINDS, CHANGELOG_LABELS } from "#shared/types/changelog";

definePageMeta({
	layout: "dashboard",
	middleware: ["auth", "admin"],
});

useSeoMeta({
	title: "Changelog",
	robots: "noindex, nofollow",
});

type Busy = "published" | "draft" | "keep" | "delete" | null;
/** What the save should do to the entry's publication state. */
type SaveAs = "published" | "draft" | "keep";

const kindOptions = CHANGELOG_KINDS.map(value => ({ value, label: CHANGELOG_LABELS[value] }));

const editorDialog = useTemplateRef<HTMLDialogElement>("editorDialog");
const confirmDialog = useTemplateRef<HTMLDialogElement>("confirmDialog");

const editorOpen = ref(false);
/** The entry being corrected, or null while writing a new one. */
const editing = ref<AdminChangelogEntry | null>(null);
const confirming = ref<AdminChangelogEntry | null>(null);

const form = reactive<{ title: string; kind: ChangelogKind; body: string }>({
	title: "",
	kind: "improvement",
	body: "",
});

const busy = ref<Busy>(null);
const toast = ref<{ variant: "success" | "error"; text: string } | null>(null);
const errors = reactive<{ title?: string; body?: string }>({});

const { data, pending, error, refresh } = await useAsyncData<{ entries: AdminChangelogEntry[] }>(
	"admin-changelog",
	() => $fetch<{ entries: AdminChangelogEntry[] }>("/api/admin/changelog", {
		headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
	}),
);

const entries = computed(() => data.value?.entries ?? []);

/**
 * What the primary button does, and — below — what it is therefore called.
 *
 * One computed for both, because the two were derived separately and disagreed
 * on the one case where the entry exists but is not published yet: the button
 * read "Publish" and sent "leave the state alone", so a draft could be edited
 * forever and never go out.
 *
 * Only an already-published entry is left alone. Everything else — a new entry,
 * or a draft being reopened — is here to be published.
 */
const submitAction = computed<SaveAs>(() => (editing.value?.published ? "keep" : "published"));

const submitLabel = computed(() => {
	if (busy.value === "published" || busy.value === "keep") return "Saving…";
	return submitAction.value === "keep" ? "Save changes" : "Publish";
});

const clearErrors = () => {
	errors.title = undefined;
	errors.body = undefined;
};

function openCreate() {
	clearErrors();
	editing.value = null;
	form.title = "";
	form.kind = "improvement";
	form.body = "";
	editorOpen.value = true;
}

function openEdit(entry: AdminChangelogEntry) {
	clearErrors();
	editing.value = entry;
	form.title = entry.title;
	form.kind = entry.kind;
	form.body = entry.body;
	editorOpen.value = true;
}

function closeEditor() {
	editorOpen.value = false;
}

/**
 * Writes the entry, either as a new row or over the one being edited.
 *
 * `as` is what should happen to its publication state: `keep` leaves it where
 * it is, which is what saving a correction to a live entry means and the reason
 * the endpoint is told rather than left to infer it.
 */
async function save(as: SaveAs) {
	clearErrors();

	if (!form.title.trim()) errors.title = "Give it a title.";
	if (!form.body.trim()) errors.body = "Say what changed.";
	if (errors.title || errors.body) return;

	busy.value = as;

	try {
		if (editing.value) {
			await $fetch(`/api/admin/changelog/${editing.value.id}`, {
				method: "PATCH",
				body: {
					title: form.title.trim(),
					body: form.body.trim(),
					kind: form.kind,
					...(as === "keep" ? {} : { state: as }),
				},
			});
		}
		else {
			await $fetch("/api/admin/changelog", {
				method: "POST",
				body: {
					title: form.title.trim(),
					body: form.body.trim(),
					kind: form.kind,
					// The endpoint reads this as a string, so the flag is only
					// ever sent when it is actually set.
					...(as === "draft" ? { draft: "true" } : {}),
				},
			});
		}

		toast.value = { variant: "success", text: savedMessage(as) };
		closeEditor();
		await refresh();
	}
	catch {
		toast.value = { variant: "error", text: "That didn't save. Try again in a moment." };
	}
	finally {
		busy.value = null;
	}
}

function savedMessage(as: SaveAs) {
	if (as === "draft") {
		return editing.value?.published
			? "Unpublished — it's off the public page."
			: "Saved as a draft. Nobody can see it yet.";
	}

	if (as === "keep") return "Saved.";

	return editing.value ? "Published." : "Published — it's on the public changelog.";
}

async function remove() {
	const entry = confirming.value;
	if (!entry) return;

	busy.value = "delete";

	try {
		await $fetch(`/api/admin/changelog/${entry.id}`, { method: "DELETE" });
		toast.value = { variant: "success", text: "Deleted." };
		confirming.value = null;
		await refresh();
	}
	catch {
		toast.value = { variant: "error", text: "That didn't delete. Try again in a moment." };
	}
	finally {
		busy.value = null;
	}
}

/**
 * The flags are the source of truth and the dialogs follow them, the same way
 * the settings column and the affiliate editor are wired.
 *
 * `showModal()` cannot be called in the tick the element is created, so the
 * watch waits one before reaching for it.
 */
watch(editorOpen, async (open) => {
	await nextTick();
	const dialog = editorDialog.value;
	if (!dialog) return;

	if (open && !dialog.open) {
		dialog.showModal();
		// showModal focuses the first tabbable thing, which is the close button
		// — so the dialog would open with the dismiss control highlighted rather
		// than the field you came here to fill in.
		dialog.querySelector<HTMLInputElement>(".field-input")?.focus();
	}
	else if (!open && dialog.open) {
		dialog.close();
	}
});

watch(confirming, async (entry) => {
	await nextTick();
	const dialog = confirmDialog.value;
	if (!dialog) return;

	// Focus is deliberately left where showModal puts it — on the close button
	// — rather than moved to the delete: the first control in a dialog that
	// destroys something should be the way out of it.
	if (entry && !dialog.open) dialog.showModal();
	else if (!entry && dialog.open) dialog.close();
});

// Escape closes a dialog without going through the buttons, so the flags have
// to be caught up. Guarded, or closing via Cancel would recurse: that path
// clears the flag, which closes the dialog, which fires this again.
function onEditorClose() {
	if (editorOpen.value) closeEditor();
}

function onConfirmClose() {
	if (confirming.value) confirming.value = null;
}

// A click landing on the <dialog> itself is a click on the backdrop — anything
// on the content hits .modal-panel and stops there.
function onEditorClick(event: MouseEvent) {
	if (event.target === editorDialog.value) closeEditor();
}

function onConfirmClick(event: MouseEvent) {
	if (event.target === confirmDialog.value) confirming.value = null;
}

useScrollLock(computed(() => editorOpen.value || confirming.value !== null));

const formatDate = (value: string) =>
	new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
</script>
