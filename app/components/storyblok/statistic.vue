<template>
	<div v-editable="blok" class="statistic-container">
		<div class="statistic">
			<p
				v-if="parsedCount"
				class="statistic-count"
				:data-count-up="parsedCount.target"
				:data-count-prefix="parsedCount.prefix"
				:data-count-suffix="parsedCount.suffix"
				:data-count-decimals="parsedCount.decimals"
			>
				{{ blok.count }}
			</p>
			<p v-else class="statistic-count">{{ blok.count }}</p>
			<p class="statistic-subtitle">{{ blok.sub_title }}</p>
		</div>
		<span class="statistic-divider"/>
	</div>
</template>

<script setup lang="ts">
import type { StatisticBlok } from "~/types/blocks";

const props = defineProps<{ blok: StatisticBlok }>();

// Split a CMS count like "250+", "$1,500" or "98.5%" into the numeric target
// and its surrounding prefix/suffix for useCountUp's data attributes.
const parsedCount = computed(() => {
	const raw = String(props.blok.count ?? "").trim();
	const match = raw.match(/^([^\d-]*)(-?[\d.,]*\d)(.*)$/);
	if (!match) return null;

	const [, prefix = "", num = "", suffix = ""] = match;
	const numeric = num.replace(/,/g, "");

	return {
		target: numeric,
		prefix,
		suffix,
		decimals: (numeric.split(".")[1] ?? "").length,
	};
});
</script>
