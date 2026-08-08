<template>
	<div class="dashSection">
		<section class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">Sales</h2>
				<a
					class="dashPanel-cta"
					href="https://whop.com/dashboard"
					target="_blank"
					rel="noopener noreferrer"
				>Manage payouts in Whop ↗</a>
			</div>

			<div v-if="data" class="statGrid">
				<NuxtDashboardStatCard label="This month" :value="data.counts.thisMonth" />
				<NuxtDashboardStatCard label="Last 30 days" :value="data.counts.last30d" />
				<NuxtDashboardStatCard label="All time" :value="data.counts.total" />
				<NuxtDashboardStatCard
					label="Conversion"
					:value="data.funnel.conversionRate === null ? '—' : `${data.funnel.conversionRate}%`"
					:hint="data.funnel.conversionRate === null ? 'No visits yet' : 'Link visits that bought'"
				/>
			</div>

			<p class="dashPanel-note">
				Commission, the 30-day hold and payouts are all handled by Whop. This page
				shows which sales came through your link — for anything about money, use the
				Whop dashboard.
			</p>
		</section>

		<section v-if="data" class="dashPanel">
			<h2 class="dashPanel-title">Last 30 days</h2>
			<ul class="funnel">
				<li class="funnel-step">
					<span class="funnel-label">Link visits</span>
					<span class="funnel-value">{{ data.funnel.visits30d.toLocaleString("en-GB") }}</span>
				</li>
				<li class="funnel-step">
					<span class="funnel-label">Sales</span>
					<span class="funnel-value">{{ data.funnel.sales30d.toLocaleString("en-GB") }}</span>
				</li>
			</ul>
			<p class="dashPanel-note">
				Both counted on our own server, so the conversion rate compares like with
				like. Only the VIP link can produce a sale — your Telegram and Calendly
				links send people somewhere useful, but nothing is sold through them.
			</p>
		</section>

		<section class="dashPanel">
			<h2 class="dashPanel-title">Who bought</h2>

			<p v-if="pending" class="dashPanel-note">Loading…</p>

			<p v-else-if="!data?.sales.length" class="dashPanel-empty">
				No sales through your link yet. When someone buys, they'll appear here
				within a minute or two.
			</p>

			<table v-else class="dataTable">
				<thead>
					<tr>
						<th scope="col">Buyer</th>
						<th scope="col">When</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="sale in data.sales" :key="sale.id">
						<td>{{ sale.buyerUsername ?? "—" }}</td>
						<td>{{ formatDate(sale.occurredAt) }}</td>
					</tr>
				</tbody>
			</table>

			<p v-if="data?.sales.length" class="dashPanel-note">
				Whop usernames only — we don't share buyers' names or email addresses.
			</p>
		</section>
	</div>
</template>

<script setup lang="ts">
interface SalesResponse {
	sales: { id: string; buyerUsername: string | null; status: string | null; occurredAt: string | null }[];
	counts: { total: number; thisMonth: number; last30d: number };
	funnel: { visits30d: number; sales30d: number; conversionRate: number | null };
	nonSellingLinks: { lite: boolean; calendly: boolean };
}

const { data, pending } = await useAsyncData<SalesResponse>("affiliate-sales", () =>
	$fetch<SalesResponse>("/api/affiliate/sales", {
		headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
	}));

const formatDate = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
		: "—";
</script>
