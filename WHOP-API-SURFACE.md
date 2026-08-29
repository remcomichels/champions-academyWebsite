# What we can read from Whop

Generated from the type definitions shipped in `@whop/sdk@0.0.42`, which is
already a dependency of this project — not from documentation and not from
memory. Every resource, method and field below is declared by the SDK we call.

Regenerate with `npm run whop:surface` after an SDK bump; the surface moves.

> **One caveat worth reading first.** This is what the *SDK declares*, which is
> not the same as what *your API key is allowed to fetch*. Whop gates some
> resources by plan and by app permissions. Treat this as the map, then confirm
> the handful you actually want with a live call.

---

## The short answer

**Yes — commission figures are readable per affiliate.** `affiliates.retrieve(id)`
returns a single `Affiliate` carrying exactly the numbers worth putting on a
dashboard:

| Field | Type |
|---|---|
| `id` | `string` |
| `active_members_count` | `number` |
| `company` | `Affiliate.Company` |
| `created_at` | `string` |
| `customer_retention_rate` | `string` |
| `customer_retention_rate_ninety_days` | `string` |
| `monthly_recurring_revenue_usd` | `string` |
| `status` | `Status \| null` |
| `total_overrides_count` | `number` |
| `total_referral_earnings_usd` | `string` |
| `total_referrals_count` | `number` |
| `total_revenue_usd` | `string` |
| `updated_at` | `string` |
| `user` | `Affiliate.User` |

`company` and `user` are nested objects (`id`/`title`, and `id`/`name`/`username`).

Note the `_usd` fields are **strings**, not numbers — they are decimal amounts
serialised as text to avoid float rounding. Do not `parseFloat` them and then
add them up in a loop.

---

## Two ways to get per-affiliate money data

This matters because the two need different things from us, and only one of
them works today.

### Route A — Whop's own affiliate object *(needs work first)*

`affiliates.retrieve(aff_xxx)` is the richest source, but it needs Whop's own
affiliate id. The `affiliates.whop_affiliate_id` column exists for exactly this
and **nothing in the codebase ever writes it** — so this route is unavailable
until an affiliate is registered on Whop's side and that id is stored.

- `list(query)` → `PagePromise<AffiliateListResponsesCursorPage, AffiliateListResponse>`
- `create(body)` → `Affiliate`
- `retrieve(id)` → `Affiliate`
- `archive(id)` → `AffiliateArchiveResponse`
- `unarchive(id)` → `AffiliateUnarchiveResponse`

`list` is filterable and sortable, which is how the id would be discovered:

| Field | Type |
|---|---|
| `company_id` | `string` |
| `before?` | `string \| null` |
| `direction?` | `Shared.Direction \| null` |
| `first?` | `number \| null` |
| `last?` | `number \| null` |
| `order?` | `'id' \| 'created_at' \| 'cached_total_referrals' \| 'cached_total_rewards` |
| `query?` | `string \| null` |
| `status?` | `Status \| null` |


### Route B — via the checkout configuration *(works today)*

We already store `whop_checkout_configuration_id` per affiliate, and
`payments.list` filters on it. That means per-affiliate payments **with
amounts** are readable right now, with no new linkage:

```ts
payments.list({ checkout_configuration_ids: [affiliate.whop_checkout_configuration_id] })
```

The full filter set:

| Field | Type |
|---|---|
| `before?` | `string \| null` |
| `billing_reasons?` | `Array<BillingReasons> \| null` |
| `checkout_configuration_ids?` | `Array<string> \| null` |
| `company_id?` | `string \| null` |
| `created_after?` | `string \| null` |
| `created_before?` | `string \| null` |
| `currencies?` | `Array<Shared.Currency> \| null` |
| `direction?` | `Shared.Direction \| null` |
| `first?` | `number \| null` |
| `include_free?` | `boolean \| null` |
| `last?` | `number \| null` |
| `order?` | `'final_amount' \| 'created_at' \| 'paid_at' \| null` |
| `plan_ids?` | `Array<string> \| null` |
| `product_ids?` | `Array<string> \| null` |
| `query?` | `string \| null` |
| `statuses?` | `Array<Shared.ReceiptStatus> \| null` |
| `substatuses?` | `Array<Shared.FriendlyReceiptStatus> \| null` |
| `updated_after?` | `string \| null` |
| `updated_before?` | `string \| null` |


What comes back per payment — the money fields, out of a much larger object:

| Field | Type |
|---|---|
| `id` | `string` |
| `amount_after_fees` | `number` |
| `application_fee` | `Payment.ApplicationFee \| null` |
| `billing_reason` | `PaymentsAPI.BillingReasons \| null` |
| `checkout_configuration_id` | `string \| null` |
| `created_at` | `string` |
| `currency` | `Currency` |
| `member` | `Payment.Member \| null` |
| `membership` | `Payment.Membership \| null` |
| `metadata` | `{ [key: string]: unknown; } \| null` |
| `paid_at` | `string \| null` |
| `plan` | `Payment.Plan \| null` |
| `product` | `Payment.Product \| null` |
| `promo_code` | `Payment.PromoCode \| null` |
| `refundable` | `boolean` |
| `refunded_amount` | `number \| null` |
| `settlement_amount` | `number` |
| `status` | `ReceiptStatus \| null` |
| `substatus` | `FriendlyReceiptStatus` |
| `subtotal` | `number \| null` |
| `tax_amount` | `number \| null` |
| `total` | `number \| null` |
| `usd_total` | `number \| null` |

Watch the units: these are `number`, where the `Affiliate` object's totals are
decimal **strings**. Two shapes for the same kind of value, so anything summing
across both has to normalise first.

This is the same object `server/utils/conversions.ts` already reads two fields
from. The amounts were always there; we chose not to store them — see the GDPR
note on `public.conversions`, which deliberately has no column for an amount.

---

## Commission and payout resources

### Affiliate overrides — the actual commission rates

- `list(id, query?)` → `PagePromise<OverrideListResponsesCursorPage, OverrideListResponse>`
- `create(id, body)` → `OverrideCreateResponse`
- `retrieve(overrideID, params)` → `OverrideRetrieveResponse`
- `update(overrideID, params)` → `OverrideUpdateResponse`
- `delete(overrideID, params)` → `OverrideDeleteResponse`

| Field | Type |
|---|---|
| `id` | `string` |
| `applies_to_payments` | `AffiliateAppliesToPayments \| null` |
| `applies_to_products` | `AffiliateAppliesToProducts \| null` |
| `checkout_direct_link` | `string \| null` |
| `commission_type` | `AffiliatePayoutTypes` |
| `commission_value` | `number` |
| `override_type` | `AffiliateOverrideRoles` |
| `plan_id` | `string \| null` |
| `product_direct_link` | `string \| null` |
| `product_id` | `string \| null` |
| `revenue_basis` | `AffiliateRevenueBases \| null` |
| `total_referral_earnings_usd` | `number` |


### Partner earnings — the payout ledger

- `list(id, query?)` → `PagePromise<EarningListResponsesCursorPage, EarningListResponse>`

| Field | Type |
|---|---|
| `id` | `string \| null` |
| `account` | `EarningListResponse.Account \| null` |
| `cancelation_reason` | `string \| null` |
| `commission_amount_usd` | `string \| null` |
| `created_at` | `string` |
| `financial_activity` | `Array<EarningListResponse.FinancialActivity> \| null` |
| `income_source` | `'sales' \| 'ad_spend' \| 'transfer' \| 'card_interchange'` |
| `object` | `'partner_business_earning'` |
| `payout_at` | `string \| null` |
| `payout_percentage` | `number \| null` |
| `product` | `EarningListResponse.Product \| null` |
| `resource` | `EarningListResponse.UnionMember0 \| null \| EarningListResponse.UnionMem` |
| `second_tier` | `boolean` |
| `status` | `'awaiting_settlement' \| 'pending' \| 'completed' \| 'canceled' \| 'revers` |
| `transaction_amount_usd` | `string` |


### Ledger accounts — balances

- `retrieve(id)` → `LedgerAccountRetrieveResponse`

| Field | Type |
|---|---|
| `id` | `string` |
| `balances` | `Array<LedgerAccountRetrieveResponse.Balance>` |
| `ledger_type` | `'primary' \| 'pool'` |
| `owner` | `LedgerAccountRetrieveResponse.User \| null \| LedgerAccountRetrieveRespo` |
| `payments_approval_status` | `'pending' \| 'approved' \| 'monitoring' \| 'rejected' \| null` |
| `payout_account_details` | `LedgerAccountRetrieveResponse.PayoutAccountDetails \| null` |
| `transfer_fee` | `number \| null` |
| `treasury_balance` | `LedgerAccountRetrieveResponse.TreasuryBalance \| null` |


### Payouts, withdrawals, transfers

- `list(query?)` → `PagePromise<PayoutListResponsesCursorPage, PayoutListResponse>`
- `create(params)` → `PayoutCreateResponse`

- `list(query?)` → `PagePromise<MethodListResponsesCursorPage, MethodListResponse>`
- `create(params)` → `MethodCreateResponse`

- `list(query)` → `PagePromise<WithdrawalListResponsesCursorPage, WithdrawalListResponse>`
- `retrieve(id)` → `Withdrawal`
- `create(body)` → `Withdrawal`
- `generatePdf(id)` → `WithdrawalGeneratePdfResponse`

- `list(query?)` → `PagePromise<TransferListResponsesCursorPage, TransferListResponse>`
- `create(params)` → `TransferCreateResponse`
- `retrieve(id)` → `TransferRetrieveResponse`

- `retrieve(id)` → `PayoutAccountRetrieveResponse`


### Financial activity

- `list(query?)` → `FinancialActivityListResponse`


### Company-level stats

- `list()` → `StatListResponse`
- `retrieve(metric, query)` → `StatRetrieveResponse`


---

## Memberships and members

Recurring revenue lives here rather than on payments — a membership is the
subscription, a payment is one charge against it.

- `list(query?)` → `PagePromise<MembershipListResponsesCursorPage, MembershipListResponse>`
- `retrieve(id)` → `Shared.Membership`
- `update(id, body?)` → `Shared.Membership`
- `cancel(id, body?)` → `Shared.Membership`
- `pause(id, body?)` → `Shared.Membership`
- `resume(id)` → `Shared.Membership`
- `uncancel(id)` → `Shared.Membership`
- `addFreeDays(id, body)` → `Shared.Membership`
- `resyncAccess(id)` → `Shared.Membership`

| Field | Type |
|---|---|
| `id` | `string` |
| `cancel_at_period_end` | `boolean` |
| `cancel_option` | `MembershipsAPI.CancelOptions \| null` |
| `canceled_at` | `string \| null` |
| `cancellation_reason` | `string \| null` |
| `checkout_configuration_id` | `string \| null` |
| `company` | `Membership.Company` |
| `created_at` | `string` |
| `currency` | `Currency \| null` |
| `custom_field_responses` | `Array<Membership.CustomFieldResponse>` |
| `joined_at` | `string \| null` |
| `license_key` | `string \| null` |
| `manage_url` | `string \| null` |
| `member` | `Membership.Member \| null` |
| `metadata` | `{ [key: string]: unknown; } \| null` |
| `payment_collection_paused` | `boolean` |
| `plan` | `Membership.Plan` |
| `product` | `Membership.Product` |
| `promo_code` | `Membership.PromoCode \| null` |
| `renewal_period_end` | `string \| null` |
| `renewal_period_start` | `string \| null` |
| `status` | `MembershipStatus` |
| `updated_at` | `string` |
| `user` | `Membership.User \| null` |


---

## Everything the SDK exposes

All 77 resources with methods, for reference.

| Resource | Methods |
|---|---|
| `access-tokens` | create |
| `account-links` | create |
| `accounts/accounts` | list, create, me, retrieve, update, recommendActions, registerLlc |
| `accounts/preferences` | retrieve, update |
| `ad-campaigns` | list, create, retrieve, update, delete, pause, unpause, retryPayment |
| `ad-groups` | list, create, retrieve, update, delete, pause, unpause, searchTargetingOptions, estimateReach |
| `ad-reports` | retrieve |
| `ads` | list, create, retrieve, update, delete, pause, unpause |
| `affiliates/affiliates` | list, create, retrieve, archive, unarchive |
| `affiliates/overrides` | list, create, retrieve, update, delete |
| `ai-chats` | list, create, retrieve, update, delete |
| `app-builds` | list, create, retrieve, promote |
| `apps` | list, create, retrieve, update, logs |
| `audiences` | list, create, delete |
| `authorized-users` | list, retrieve, create, delete |
| `bounties` | list, create, retrieve, update |
| `bounty-submissions` | list, create |
| `cards` | list, create, retrieve, update |
| `chat-channels` | list, retrieve, update |
| `checkout-configurations` | list, create, retrieve, delete |
| `companies` | retrieve, list, create, update, createAPIKey |
| `company-token-transactions` | list, create, retrieve |
| `course-chapters` | list, create, retrieve, update, delete |
| `course-lesson-interactions` | list, retrieve |
| `course-lessons` | list, create, retrieve, update, delete, markAsCompleted, start, submitAssessment |
| `course-students` | list, retrieve |
| `courses` | list, create, retrieve, update, delete |
| `deposits` | create |
| `dispute-alerts` | list, retrieve |
| `disputes` | list, retrieve, submitEvidence, updateEvidence |
| `dm-channels` | list, create, retrieve, update, delete |
| `dm-members` | list, create, retrieve, update, delete |
| `entries` | list, retrieve, approve, deny |
| `events` | list, create |
| `experiences` | list, create, retrieve, update, delete, attach, detach, duplicate |
| `fee-markups` | list, create, delete |
| `files` | retrieve, create, upload |
| `financial-activity` | list |
| `forum-posts` | list, create, retrieve, update |
| `forums` | list, retrieve, update |
| `invoices` | list, create, retrieve, void, markPaid, markUncollectible, update, delete |
| `leads` | list, create, retrieve, update |
| `ledger-accounts` | retrieve |
| `media` | generate, retrieve |
| `members` | list, retrieve |
| `memberships` | list, retrieve, update, cancel, pause, resume, uncancel, addFreeDays, resyncAccess |
| `messages` | list, retrieve, create, update, delete |
| `notifications` | create |
| `partners/businesses/businesses` | list, retrieve |
| `partners/businesses/earnings` | list |
| `partners/partners` | referredUsers, create, leaderboard |
| `payment-methods` | list, retrieve |
| `payments` | list, retrieve, refund, retry, void, create, listFees |
| `payout-accounts` | retrieve |
| `payouts/methods` | list, create |
| `payouts/payouts` | list, create |
| `people` | list, retrieve |
| `plans` | list, create, retrieve, update, delete, calculateTax |
| `products` | list, retrieve, create, update, delete |
| `promo-codes` | list, create, retrieve, delete |
| `reactions` | list, create, retrieve, delete |
| `refunds` | list, retrieve |
| `resolution-center-cases` | list, retrieve |
| `reviews` | list, retrieve |
| `setup-intents` | list, retrieve |
| `shipments` | list, create, retrieve |
| `social-accounts` | list, create, connect, delete, posts, leadForms |
| `stats` | list, retrieve |
| `support-channels` | list, retrieve, create |
| `swaps` | createQuote, create, list, retrieve |
| `team-members` | list, retrieve, create, update, delete |
| `topups` | create |
| `transfers` | list, create, retrieve |
| `users` | retrieve, checkAccess, update, updateMe, list, recommendActions |
| `verifications` | list, retrieve, create, update |
| `webhooks` | unwrap, list, create, retrieve, update, delete |
| `withdrawals` | list, retrieve, create, generatePdf |

---

## What this project uses today

| Call | Where | Purpose |
|---|---|---|
| `POST /checkout_configurations` | `server/utils/whopAdmin.ts` | Creates the per-affiliate checkout carrying `metadata.affiliate_user_id` |
| `GET /payments` | `server/utils/whopAdmin.ts` → `listCompanyPayments` | Backfill reconciliation |
| `payment.succeeded` webhook | `server/api/webhooks/whop.post.ts` | Credits a sale |

Both calls go through a hand-rolled `$fetch` in `whopAdmin.ts` pinned to
`Api-Version-Date: 2026-07-20`, not through the SDK client — the SDK is
currently used only for webhook signature verification. Anything built from
this document should decide deliberately which of the two to use, because the
pinned version header is what stops an unversioned request silently getting an
older API with different parameter names.

## What is not wired

- `affiliates.whop_affiliate_id` — declared in the schema, read into
  `AffiliateRow`, never written. Route A above depends on it.
- `affiliates.whop_username` — collected in the admin panel and never sent
  anywhere. Reference data only.
- `public.whop_stats_cache` — a table built to hold exactly the figures in this
  document, with an `ok`/`last_error` pair so the dashboard can show
  last-known values instead of zeroes when Whop is unreachable. Currently empty
  and unread.
