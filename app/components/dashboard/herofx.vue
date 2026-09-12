<template>
	<div class="dashSection">
		<header class="dashHead">
			<h2 class="dashHead-title">Your IB network</h2>
			<div v-if="data?.linked" class="rangeTabs">
				<button
					v-for="option in ranges"
					:key="option.id"
					type="button"
					class="rangeTabs-tab"
					:class="{ 'is-active': range === option.id }"
					@click="range = option.id"
				>
					{{ option.label }}
				</button>
			</div>
		</header>

		<NuxtAlertBanner v-if="error" variant="error">
			Couldn't load your network just now. Try again in a minute.
		</NuxtAlertBanner>

		<!-- ── Not connected ──────────────────────────────────────────────── -->
		<section v-else-if="data && !data.linked" class="dashPanel herofxConnect">
			<h2 class="dashPanel-title">Connect your HeroFX account</h2>
			<p class="dashPanel-note">
				We match your dashboard account to your HeroFX partner account by email.
				Sign in here with the <strong>same email address you use at HeroFX</strong>
				and this tab fills itself in within a few minutes — there's nothing to
				enter and no password to share.
			</p>
			<p class="dashPanel-note">
				Already using a different address here? Send your HeroFX partner ID to
				your account manager and they'll link it by hand.
			</p>
			<p v-if="updatedLabel" class="herofxMeta">Network data last updated {{ updatedLabel }}.</p>
		</section>

		<template v-else-if="data?.linked">
			<!-- ── How current this is ────────────────────────────────────── -->
			<NuxtAlertBanner v-if="data.sync.failing" variant="error">
				These figures are not updating. The last sync with HeroFX failed{{ updatedLabel ? `, so everything below is from ${updatedLabel}` : "" }}.
			</NuxtAlertBanner>

			<!-- Warning, not error: their feed being a few cycles behind is a
			     caveat on the figures, where our own sync failing means they
			     have stopped moving altogether. -->
			<NuxtAlertBanner v-else-if="data.sync.staleJobs.length" variant="warning">
				HeroFX's own data is behind on {{ data.sync.staleJobs.map(job => job.job).join(", ") }},
				so some of these figures may be older than they look.
			</NuxtAlertBanner>

			<!-- ── The five figures ───────────────────────────────────────── -->
			<div class="statGrid">
				<NuxtDashboardStatCard
					label="Registered"
					:value="data.figures.registered"
					icon="user"
					:trend="trendFor('registered')"
					hint="New sign-ups in your network"
					:loading="pending"
				/>
				<NuxtDashboardStatCard
					label="Deposited"
					:value="data.figures.deposited"
					icon="check"
					:trend="trendFor('deposited')"
					hint="Made their first deposit"
					:loading="pending"
				/>
				<NuxtDashboardStatCard
					label="Deposits"
					:value="money(data.figures.depositsUsd)"
					icon="tag"
					accent
					:trend="trendFor('depositsUsd')"
					:hint="`${money(data.figures.withdrawalsUsd)} withdrawn`"
					:loading="pending"
				/>
				<NuxtDashboardStatCard
					label="Network clients"
					:value="data.figures.networkClients"
					icon="globe"
					:hint="subIbHint"
					:loading="pending"
				/>
				<!-- Only for the codes the broker actually files commission
				     against. Our root code has none by their configuration, and a
				     tile that can only ever read $0 is worse than no tile. -->
				<NuxtDashboardStatCard
					v-if="showCommission"
					label="Your commission"
					:value="money(data.figures.commissionUsd)"
					icon="chart"
					:trend="trendFor('commissionUsd')"
					hint="Filed a day in arrears"
					:loading="pending"
				/>
			</div>

			<p class="dashNote">
				<strong>Your network</strong> is everyone below you: the people who signed
				up with your own link, plus everyone your sub-IBs brought in. Money is
				counted when the broker confirms it, on the date the client started the
				payment. Clients who leave the structure disappear from HeroFX entirely,
				so a total can go down as well as up.
			</p>

			<!-- ── Sub-IBs ────────────────────────────────────────────────── -->
			<section class="dashPanel" :aria-busy="pending || undefined">
				<div class="dashPanel-head">
					<h2 class="dashPanel-title">Your sub-IBs</h2>
					<span v-if="data.subIbs.length" class="dashPanel-count">{{ data.subIbs.length }}</span>
				</div>

				<p v-if="!data.subIbs.length" class="dashPanel-empty">
					No sub-IBs yet. When someone in your network gets their own partner
					code, their branch shows up here.
				</p>

				<div v-else class="adminTableWrap">
					<table class="dataTable herofxTable">
						<thead>
							<tr>
								<th scope="col">Sub-IB</th>
								<th scope="col" class="is-num">Direct</th>
								<th scope="col" class="is-num">Network</th>
								<th scope="col" class="is-num">Deposits</th>
								<th scope="col" class="is-num">Commission</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="row in data.subIbs" :key="row.code">
								<td>
									<span class="herofxName">{{ row.ownerName ?? "—" }}</span>
									<span class="herofxId">IB {{ row.code }}</span>
								</td>
								<td class="is-num">{{ row.directClients.toLocaleString("en-GB") }}</td>
								<td class="is-num">{{ row.networkClients.toLocaleString("en-GB") }}</td>
								<td class="is-num">{{ money(row.depositsUsd) }}</td>
								<!-- Negative is a clawback, not an error: the broker
								     reverses an earlier accrual and files it as a
								     negative row. Shown as it stands. -->
								<td class="is-num" :class="{ 'is-negative': row.commissionUsd < 0 }">
									{{ money(row.commissionUsd) }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>

			<!-- ── Clients ────────────────────────────────────────────────── -->
			<section class="dashPanel" :aria-busy="pending || undefined">
				<div class="dashPanel-head">
					<h2 class="dashPanel-title">Clients</h2>
					<input
						v-model="search"
						class="field-input herofxSearch"
						type="search"
						placeholder="Search name or country…"
					>
				</div>

				<p v-if="!data.clients.length" class="dashPanel-empty">
					Nobody in your network has registered with HeroFX yet.
				</p>
				<p v-else-if="!visibleClients.length" class="dashPanel-empty">
					No client matches “{{ search }}”.
				</p>

				<div v-else class="adminTableWrap">
					<table class="dataTable herofxTable">
						<thead>
							<tr>
								<th scope="col">Client</th>
								<th scope="col">Country</th>
								<th scope="col">Status</th>
								<th scope="col">Via</th>
								<th scope="col">Registered</th>
								<th scope="col">First deposit</th>
								<th scope="col" class="is-num">Deposits</th>
								<th scope="col" class="is-num">Withdrawn</th>
								<th scope="col" class="is-num">Balance</th>
								<th scope="col">Last seen</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="client in visibleClients" :key="client.userId">
								<td>
									<span class="herofxName">{{ client.name ?? "—" }}</span>
									<span class="herofxId">#{{ client.userId }}</span>
									<span v-if="client.isSubIb" class="herofxBadge">Sub-IB</span>
								</td>
								<td>
									<span v-if="client.country" class="herofxCountry">
										<NuxtAppImage
											v-if="flagOf(client.country)"
											:src="flagOf(client.country)!"
											alt=""
											class="herofxFlag"
											:width="16"
											:height="16"
										/>{{ countryName(client.country) }}
									</span>
									<span v-else>—</span>
								</td>
								<td>{{ statusLabel(client.status) }}</td>
								<!-- Null means they used this affiliate's own link. -->
								<td>{{ client.via ?? "You" }}</td>
								<td>{{ date(client.registeredAt) }}</td>
								<td>{{ date(client.ftdDate) }}</td>
								<td class="is-num">{{ money(client.depositsUsd) }}</td>
								<td class="is-num">{{ money(client.withdrawalsUsd) }}</td>
								<td class="is-num">{{ money(client.balanceUsd) }}</td>
								<td>{{ date(client.lastSeen) }}</td>
							</tr>
						</tbody>
					</table>
				</div>

				<p v-if="data.clientsTruncated" class="dashPanel-note">
					Showing the {{ CLIENT_LIMIT.toLocaleString("en-GB") }} most recent
					clients. Ask your account manager for the full list.
				</p>

				<p v-if="updatedLabel" class="herofxMeta">Updated {{ updatedLabel }}</p>
			</section>
		</template>
	</div>
</template>

<script setup lang="ts">
/**
 * The HeroFX IB tab.
 *
 * Everything here comes from our own copy of the broker's feed, refreshed by
 * /api/internal/herofx-sync every few minutes — never from HeroFX directly.
 * Their feed allows five connections in total, so a page that queried it would
 * lock the sync out of its own data the first time two affiliates looked at
 * once.
 *
 * What an affiliate sees is their whole downline and nothing above it. That is
 * enforced server-side from the partner code on their account; there is no id
 * in any request this component makes.
 */

interface Figures {
	registered: number;
	deposited: number;
	depositsUsd: number;
	withdrawalsUsd: number;
	networkClients: number;
	subIbs: number;
	balanceUsd: number;
	commissionUsd: number;
}

interface SubIbRow {
	code: string;
	ownerName: string | null;
	directClients: number;
	networkClients: number;
	depositsUsd: number;
	commissionUsd: number;
}

interface ClientRow {
	userId: number;
	name: string | null;
	country: string | null;
	status: string | null;
	/** Null for a direct sign-up; the sub-IB's name for anyone below one. */
	via: string | null;
	isSubIb: boolean;
	registeredAt: string | null;
	ftdDate: string | null;
	depositsUsd: number;
	withdrawalsUsd: number;
	balanceUsd: number;
	lastSeen: string | null;
}

interface SyncState {
	updatedAt: string | null;
	failing: boolean;
	staleJobs: { job: string; status: string | null }[];
}

type HerofxResponse =
	| { linked: false; sync: SyncState }
	| {
		linked: true;
		code: string;
		days: number | null;
		sync: SyncState;
		figures: Figures;
		previous: Figures | null;
		subIbs: SubIbRow[];
		clients: ClientRow[];
		clientsTruncated: boolean;
	};

/** Mirrors the cap in server/api/affiliate/herofx.get.ts. */
const CLIENT_LIMIT = 500;

const ranges = [
	{ id: "7", label: "7d" },
	{ id: "30", label: "30d" },
	{ id: "90", label: "90d" },
	{ id: "all", label: "All" },
] as const;

type RangeId = typeof ranges[number]["id"];

const range = useState<RangeId>("herofx-range", () => "30");

const rangeQuery = computed(() =>
	(range.value === "all" ? { range: "all" } : { days: Number(range.value) }));

const headers = () => (import.meta.server ? useRequestHeaders(["cookie"]) : undefined);

const { data, pending, error } = await useAsyncData<HerofxResponse>(
	"affiliate-herofx",
	() => $fetch<HerofxResponse>("/api/affiliate/herofx", {
		query: rangeQuery.value,
		headers: headers(),
	}),
	{ watch: [range] },
);

// Link clicks deliberately do not appear here. The figure exists on Analytics
// already, counted from our own server, and the same number on two tabs over
// two different ranges reads as two numbers that disagree. Nothing on this tab
// comes from anywhere but the HeroFX copy.
const priorLabel = computed(() =>
	(range.value === "all" ? "vs before" : `vs previous ${range.value} days`));

/**
 * The change on one figure against the equally long window before it.
 *
 * Null for the all-time range, where there is no earlier window to compare
 * with — the server does not even fetch one. Same reasoning as the all-time
 * tile on Overview: an arrow there would be invented.
 */
function trendFor(key: keyof Figures) {
	if (!data.value?.linked || !data.value.previous) return null;
	return trend(data.value.figures[key], data.value.previous[key], priorLabel.value);
}

const showCommission = computed(() =>
	Boolean(data.value?.linked
		&& (data.value.figures.commissionUsd !== 0 || data.value.previous?.commissionUsd)));

const subIbHint = computed(() => {
	if (!data.value?.linked) return null;
	const count = data.value.figures.subIbs;
	if (!count) return "No sub-IBs yet";
	return `${count.toLocaleString("en-GB")} ${count === 1 ? "is a sub-IB" : "are sub-IBs"}`;
});

const search = ref("");

const visibleClients = computed(() => {
	if (!data.value?.linked) return [];

	const term = search.value.trim().toLowerCase();
	if (!term) return data.value.clients;

	return data.value.clients.filter(client =>
		client.name?.toLowerCase().includes(term)
		|| client.via?.toLowerCase().includes(term)
		|| (client.country && countryName(client.country).toLowerCase().includes(term))
		|| String(client.userId).includes(term));
});

/**
 * Whole dollars, everywhere.
 *
 * The feed carries cents and they are real, but a table of ten columns reading
 * "$1,234.56" is harder to compare down a column than "$1,235" — and no
 * decision on this page turns on the cents.
 */
const money = (value: number) =>
	value.toLocaleString("en-GB", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	});

const date = (iso: string | null) =>
	(iso
		? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
		: "—");

/**
 * The broker's own KYC vocabulary, in words an affiliate can act on.
 *
 * Six values are documented and only two occur in the structure today, so an
 * unknown one is passed through rather than hidden — a raw value on screen is
 * a worse day than a blank cell, but a blank cell is a worse week.
 */
const STATUS_LABELS: Record<string, string> = {
	incomplete: "KYC incomplete",
	unverified: "Awaiting review",
	verified: "Verified",
	verified_new_documents: "New documents under review",
	need_income_sources: "Source of funds needed",
	verified_income_sources: "Source of funds accepted",
};

const statusLabel = (status: string | null) =>
	(status ? STATUS_LABELS[status] ?? status : "—");

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const countryName = (code: string) => {
	// An unrecognised ISO code must not throw the whole table.
	try {
		return regionNames.of(code) ?? code;
	}
	catch {
		return code;
	}
};

/** Null for any country the flag set has no drawing for. */
const flagOf = (code: string) => resolveCountryFlagByCode(code);

/**
 * "4 minutes ago", from the last successful sync.
 *
 * Relative rather than a timestamp: the only question this answers is whether
 * the figures are current, and "14:32" needs the reader to work that out.
 */
const updatedLabel = computed(() => {
	const iso = data.value?.sync.updatedAt;
	if (!iso) return null;

	const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);

	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;

	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

	const days = Math.round(hours / 24);
	return `${days} ${days === 1 ? "day" : "days"} ago`;
});
</script>
