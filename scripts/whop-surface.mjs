/**
 * Regenerates WHOP-API-SURFACE.md from the installed @whop/sdk types.
 *
 * Run with `npm run whop:surface` after bumping the SDK. Reads the shipped
 * .d.ts files rather than any documentation, so the output cannot drift from
 * the version this project actually calls.
 *
 * Node, not TypeScript: it runs outside the Nuxt build and imports the
 * compiler API directly, which vue-tsc would have nothing to say about.
 */
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const ROOT = "node_modules/@whop/sdk/resources";

/** Every .d.ts under resources/, flat files and one level of nesting. */
function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(full));
    else if (e.name.endsWith(".d.ts") && !e.name.endsWith(".d.mts")) out.push(full);
  }
  return out;
}

const classes = new Map();   // resource -> [{ name, signature, doc }]
const interfaces = new Map(); // interface name -> [{ field, type, doc }]

for (const file of files(ROOT)) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const rel = path.relative(ROOT, file).replace(/\.d\.ts$/, "");

  const docOf = (node) => {
    const ranges = ts.getLeadingCommentRanges(src.text, node.pos) ?? [];
    const text = ranges.map(r => src.text.slice(r.pos, r.end)).join("\n");
    return text
      .replace(/\/\*\*?|\*\//g, "")
      .split("\n").map(l => l.replace(/^\s*\*ic?\s?/, "").replace(/^\s*\*\s?/, "").trim())
      .filter(l => l && !l.startsWith("@") && !l.startsWith("```") && !l.includes("const ") && !l.includes("await "))
      .join(" ").trim();
  };

  src.forEachChild((node) => {
    if (ts.isClassDeclaration(node) && node.heritageClauses?.some(h => h.getText(src).includes("APIResource"))) {
      const methods = [];
      for (const m of node.members) {
        if (!ts.isMethodDeclaration(m) || !m.name) continue;
        const name = m.name.getText(src);
        const ret = m.type ? m.type.getText(src) : "";
        const params = m.parameters
          .filter(p => !/options\??:/.test(p.getText(src)))
          .map(p => p.name.getText(src) + (p.questionToken ? "?" : ""))
          .join(", ");
        methods.push({ name, params, ret: ret.replace(/APIPromise<(.*)>/s, "$1"), doc: docOf(m) });
      }
      if (methods.length) classes.set(rel, methods);
    }

    if (ts.isInterfaceDeclaration(node)) {
      const fields = [];
      for (const member of node.members) {
        if (!ts.isPropertySignature(member) || !member.name) continue;
        fields.push({
          field: member.name.getText(src) + (member.questionToken ? "?" : ""),
          type: (member.type?.getText(src) ?? "unknown").replace(/\s+/g, " ").slice(0, 70),
          doc: docOf(member),
        });
      }
      if (fields.length) interfaces.set(node.name.getText(src), fields);
    }
  });
}

const d = {
  classes: Object.fromEntries(classes),
  interfaces: Object.fromEntries(interfaces),
};

// ── Markdown ─────────────────────────────────────────────────────────────────
const sdkVersion = JSON.parse(fs.readFileSync("node_modules/@whop/sdk/package.json", "utf8")).version;

const table = (name, only) => {
  const fields = d.interfaces[name];
  if (!fields) return `_(\`${name}\` not found in the SDK types.)_\n`;
  // A pipe inside a union type ends the table cell, so it has to be escaped
  // even within backticks — GitHub splits the row before it parses the code span.
  const cell = (t) => t.replace(/\|/g, "\\|");
  const picked = only ? fields.filter(f => only.includes(f.field.replace("?", ""))) : fields;
  const missing = only ? only.filter(name => !fields.some(f => f.field.replace("?", "") === name)) : [];
  if (missing.length) console.warn(`  ${name}: no such field(s): ${missing.join(", ")}`);
  const rows = picked.map(f => `| \`${f.field}\` | \`${cell(f.type)}\` |`).join("\n");
  return `| Field | Type |\n|---|---|\n${rows}\n`;
};

const methods = (key) => {
  const ms = d.classes[key];
  if (!ms) return `_(\`${key}\` exposes no methods.)_\n`;
  return ms.map(m => `- \`${m.name}(${m.params})\` → \`${m.ret}\``).join("\n") + "\n";
};

const allResources = Object.keys(d.classes).sort().map((key) => {
  const names = d.classes[key].map(m => m.name).join(", ");
  return `| \`${key}\` | ${names} |`;
}).join("\n");

const out = `# What we can read from Whop

Generated from the type definitions shipped in \`@whop/sdk@${sdkVersion}\`, which is
already a dependency of this project — not from documentation and not from
memory. Every resource, method and field below is declared by the SDK we call.

Regenerate with \`npm run whop:surface\` after an SDK bump; the surface moves.

> **One caveat worth reading first.** This is what the *SDK declares*, which is
> not the same as what *your API key is allowed to fetch*. Whop gates some
> resources by plan and by app permissions. Treat this as the map, then confirm
> the handful you actually want with a live call.

---

## The short answer

**Yes — commission figures are readable per affiliate.** \`affiliates.retrieve(id)\`
returns a single \`Affiliate\` carrying exactly the numbers worth putting on a
dashboard:

${table("Affiliate")}
\`company\` and \`user\` are nested objects (\`id\`/\`title\`, and \`id\`/\`name\`/\`username\`).

Note the \`_usd\` fields are **strings**, not numbers — they are decimal amounts
serialised as text to avoid float rounding. Do not \`parseFloat\` them and then
add them up in a loop.

---

## Two ways to get per-affiliate money data

This matters because the two need different things from us, and only one of
them works today.

### Route A — Whop's own affiliate object *(needs work first)*

\`affiliates.retrieve(aff_xxx)\` is the richest source, but it needs Whop's own
affiliate id. The \`affiliates.whop_affiliate_id\` column exists for exactly this
and **nothing in the codebase ever writes it** — so this route is unavailable
until an affiliate is registered on Whop's side and that id is stored.

${methods("affiliates/affiliates")}
\`list\` is filterable and sortable, which is how the id would be discovered:

${table("AffiliateListParams")}

### Route B — via the checkout configuration *(works today)*

We already store \`whop_checkout_configuration_id\` per affiliate, and
\`payments.list\` filters on it. That means per-affiliate payments **with
amounts** are readable right now, with no new linkage:

\`\`\`ts
payments.list({ checkout_configuration_ids: [affiliate.whop_checkout_configuration_id] })
\`\`\`

The full filter set:

${table("PaymentListParams")}

What comes back per payment — the money fields, out of a much larger object:

${table("Payment", [
  "id", "amount_after_fees", "currency", "status", "substatus", "paid_at",
  "created_at", "checkout_configuration_id", "metadata", "refundable",
  "refunded_amount", "subtotal", "total", "usd_total", "settlement_amount",
  "tax_amount", "application_fee",
  "billing_reason", "plan", "product", "member", "membership", "promo_code",
])}
Watch the units: these are \`number\`, where the \`Affiliate\` object's totals are
decimal **strings**. Two shapes for the same kind of value, so anything summing
across both has to normalise first.

This is the same object \`server/utils/conversions.ts\` already reads two fields
from. The amounts were always there; we chose not to store them — see the GDPR
note on \`public.conversions\`, which deliberately has no column for an amount.

---

## Commission and payout resources

### Affiliate overrides — the actual commission rates

${methods("affiliates/overrides")}
${table("OverrideListResponse")}

### Partner earnings — the payout ledger

${methods("partners/businesses/earnings")}
${table("EarningListResponse")}

### Ledger accounts — balances

${methods("ledger-accounts")}
${table("LedgerAccountRetrieveResponse")}

### Payouts, withdrawals, transfers

${methods("payouts/payouts")}
${methods("payouts/methods")}
${methods("withdrawals")}
${methods("transfers")}
${methods("payout-accounts")}

### Financial activity

${methods("financial-activity")}

### Company-level stats

${methods("stats")}

---

## Memberships and members

Recurring revenue lives here rather than on payments — a membership is the
subscription, a payment is one charge against it.

${methods("memberships")}
${table("Membership")}

---

## Everything the SDK exposes

All ${Object.keys(d.classes).length} resources with methods, for reference.

| Resource | Methods |
|---|---|
${allResources}

---

## What this project uses today

| Call | Where | Purpose |
|---|---|---|
| \`POST /checkout_configurations\` | \`server/utils/whopAdmin.ts\` | Creates the per-affiliate checkout carrying \`metadata.affiliate_user_id\` |
| \`GET /payments\` | \`server/utils/whopAdmin.ts\` → \`listCompanyPayments\` | Backfill reconciliation |
| \`payment.succeeded\` webhook | \`server/api/webhooks/whop.post.ts\` | Credits a sale |

Both calls go through a hand-rolled \`$fetch\` in \`whopAdmin.ts\` pinned to
\`Api-Version-Date: 2026-07-20\`, not through the SDK client — the SDK is
currently used only for webhook signature verification. Anything built from
this document should decide deliberately which of the two to use, because the
pinned version header is what stops an unversioned request silently getting an
older API with different parameter names.

## What is not wired

- \`affiliates.whop_affiliate_id\` — declared in the schema, read into
  \`AffiliateRow\`, never written. Route A above depends on it.
- \`affiliates.whop_username\` — collected in the admin panel and never sent
  anywhere. Reference data only.
- \`public.whop_stats_cache\` — a table built to hold exactly the figures in this
  document, with an \`ok\`/\`last_error\` pair so the dashboard can show
  last-known values instead of zeroes when Whop is unreachable. Currently empty
  and unread.
`;

fs.writeFileSync("WHOP-API-SURFACE.md", out);
console.log("wrote WHOP-API-SURFACE.md");
