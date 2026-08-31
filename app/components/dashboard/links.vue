<template>
	<div class="dashSection">
		<section class="dashPanel">
			<h2 class="dashPanel-title">Your referral link</h2>
			<NuxtDashboardCopyField :value="summary.referralUrl" @copied="onCopied" />

			<div class="qr">
				<!-- eslint-disable-next-line vue/html-self-closing -->
				<img
					class="qr-image"
					:src="qrSrc"
					alt="QR code for your referral link"
					width="180"
					height="180"
				>
				<div class="qr-side">
					<p class="dashPanel-note">Point a phone camera at this and it opens your link. Good for stories, slides and print.</p>
					<!-- eslint-disable-next-line link-checker/valid-route, link-checker/valid-sitemap-link -- server route (server/api/affiliate/qr.get.ts), not a page; the checker only knows the page router -->
					<a class="qr-download" href="/api/affiliate/qr" download>Download SVG</a>
				</div>
			</div>
		</section>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Where your buttons point</h2>
			<p class="dashPanel-note">
				When someone visits through your link, these replace the standard links on the site.
				Leave one blank and that button keeps the standard link.
			</p>

			<NuxtAlertBanner v-if="saved" variant="success">
				Saved. The site picks this up within 5 minutes.
			</NuxtAlertBanner>
			<NuxtAlertBanner v-if="formError" variant="error">
				{{ formError }}
			</NuxtAlertBanner>

			<form class="dashForm" novalidate @submit.prevent="save">
				<NuxtAuthField
					v-model="form.liteTelegramUrl"
					label="Telegram (Lite)"
					type="url"
					placeholder="https://t.me/yourchannel"
					:error="errors.liteTelegramUrl"
					hint="Must be a t.me link."
				/>

				<NuxtAuthField
					v-model="form.calendlyUrl"
					label="Calendly"
					type="url"
					placeholder="https://calendly.com/you/intro"
					:error="errors.calendlyUrl"
					hint="Must be a calendly.com link."
				/>

				<button type="submit" class="btn btn--primary dashForm-submit" :disabled="pending">
					{{ pending ? "Saving…" : "Save links" }}
				</button>
			</form>
		</section>
	</div>
</template>

<script setup lang="ts">
import type { AffiliateSummary } from "~/composables/useAffiliateSummary";

const props = defineProps<{ summary: AffiliateSummary }>();
const emit = defineEmits<{ refresh: [] }>();

/**
 * A plain <img>, not <NuxtAppImage>.
 *
 * The house rule exists to route images through the Storyblok image pipeline
 * for responsive sizing and CLS protection. None of that applies here: this is
 * a private, per-affiliate SVG generated on demand behind the session cookie,
 * at a fixed size, which must never be optimised, proxied or cached.
 *
 * Bound rather than a literal src so Vite treats it as a runtime URL — as a
 * static attribute Rollup tries to resolve it as a build-time asset and the
 * build fails.
 */
const qrSrc = "/api/affiliate/qr";

const form = reactive({
	liteTelegramUrl: props.summary.links.lite ?? "",
	calendlyUrl: props.summary.links.calendly ?? "",
});

const errors = ref<Record<string, string | undefined>>({});
const formError = ref<string | null>(null);
const saved = ref(false);
const pending = ref(false);

async function save() {
	if (pending.value) return;

	errors.value = {};
	formError.value = null;
	saved.value = false;
	pending.value = true;

	try {
		await $fetch("/api/affiliate/links", {
			method: "PATCH",
			body: {
				liteTelegramUrl: form.liteTelegramUrl.trim(),
				calendlyUrl: form.calendlyUrl.trim(),
			},
		});

		saved.value = true;
		emit("refresh");
	}
	catch (error) {
		const data = (error as { data?: { data?: { field?: string; message?: string }; statusMessage?: string } })?.data;
		const field = data?.data?.field;

		// Put the message next to the offending input when the API named one,
		// so the affiliate does not have to work out which of the two is wrong.
		if (field) errors.value[field] = data?.data?.message ?? data?.statusMessage ?? "Invalid link";
		else formError.value = data?.statusMessage ?? "Could not save those links.";
	}
	finally {
		pending.value = false;
	}
}

async function onCopied() {
	try {
		await $fetch("/api/affiliate/link-shared", { method: "POST" });
		emit("refresh");
	}
	catch {
		// Ignored — the copy itself already succeeded.
	}
}
</script>
