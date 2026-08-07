# NEOS DMS — Backend Implementation Plan & Progress Tracker

> Living document. Update checkboxes only when work is actually verified (tests pass, PR merged).

## 1. Context

- Product vision: `DMS_REQUIREMENTS_SPEC`
- Reference schema: `reference_migrations/` (8 PostgreSQL/Knex migrations)
- Backend: `neos_dms_backend/` — NestJS 11, TypeScript ^5.7 (NodeNext, `strictNullChecks`, `isolatedModules`), Jest
- Frontend: `neos_dms_frontend/` — deferred (out of current scope)
- Legacy converter: root `Nepali_Date_converter` — ported to `src/nepali-date/` (done)

## 2. Decisions Log

| # | Decision | Status | Notes |
|---|----------|--------|-------|
| 1 | DB = PostgreSQL | Confirmed | Reference schema uses `jsonb`, partial unique indexes, CHECK constraints |
| 2 | ORM = TypeORM (1.x) + `@nestjs/typeorm` | Confirmed | Decorator entities, supports PG constraints via `@Index({where})`, `@Check`, `jsonb` |
| 3 | Feature focus order | **Revised (DMS pivot)** | Tenant+Subscription → IAM → Accounting engine → Trading → **DMS field sales (routes/outlets/visits)** → Inventory → Sales/AR → **Dispatch & Delivery** → Purchase/AP → Reports (FMCG priority; see §9–14) |
| 4 | `tsconfig` `baseUrl` | **Resolved: removed** | Deprecated; no imports rely on it (all relative paths) |
| 5 | `noImplicitAny` | Current: `false` | Prefer keeping false for now; revisit per-file |
| 6 | Migrations | Never `synchronize: true` in prod; `migration:generate` from entities, review, commit | |
| 7 | API versioning | `/api/v1` prefix | |
| 8 | Auth | JWT (access + refresh) + **DB-backed refresh sessions with rotation**, bcrypt | **Built in Phase 2** — opaque refresh token, only SHA-256 hash persisted; rotation revokes old session; one-org-per-user; per-org roles with per-request permission resolution (no stale JWTs) |
| 9 | Frontend | Out of scope this round | |
| 10 | Verticals | **Single vertical: General Trade** — drop `verticals` & `vertical_module_mappings`; price matrices not vertical-scoped | Simplifies subscription + tenant model |
| 11 | Product scope | **FMCG distribution MVP** — implement a subset of the multi-vertical reference schema, tiered P0/P1/drop (see §3.1) | Reference was built for GT/retail/pharma/restro; FMCG only |
| 12 | Subscription model | **Usage & seats, not module gating** — plans carry a `limits` jsonb (seat / periodic / feature-flag); **drop `plan_module_mappings`** | Every FMCG plan needs the full order→invoice→stock flow; plans differ by scale (see §5.2) |
| 13 | Limit enforcement | Service layer via `PlanLimitService` + `@PlanLimit(code)` decorator; seat = live COUNT in txn, periodic = atomic counter with inline rollover reset | No scheduler; race-safe |
| 14 | Accounting subset | **NPR-only MVP** — `exchange_rates`, `attachments`, `transaction_tags`/`journal_entry_tags` deferred to P1; keep the full posting engine | Single-currency FMCG distributors |
| 15 | Allocation simplification | Replace the 7 allocation-chain junction tables with direct FK references; keep only partial-payment allocations (`customer_receipt_invoice_allocations`, `supplier_payment_bill_allocations`) | Order→invoice→return chains are over-modeled for MVP |
| 16 | Inventory | Batches/expiry = P1, **serials dropped** (electronics vertical); MVP tracks locations, transactions, balances | FMCG expiry is real but P1; serials not needed |
| 17 | Trading masters | `variant_attributes` deferred to P1; FMCG SKUs stay simple (item + brand + category + UOM) | |
| 18 | MVP includes | **Sales-return credit-note flow + expenses are in MVP** (damage/expiry returns and petty cash are daily FMCG); resolved the §3.1 cut-lines | |
| 19 | Fiscal year basis | **Revised: Shrawan 1 (statutory)** | §7 originally said Baisakh 1 (BS calendar year) while §16 said Shrawan — a real contradiction. Resolved to Nepal's statutory IRD fiscal year: FY `2083/84` = 2026-07-17 → 2027-07-16, 12 periods Shrawan→Chaitra of `bsYear` then Baisakh→Ashadh of `bsYear+1`. `buildFiscalYearPlan` + provisioning updated; migration `FixFiscalYearShrawanBasis1786080000000` rebuilds existing orgs' FYs (label year parsed from the FY name, so it is deterministic and preserves FY ids/names) |
| 20 | Journal source idempotency | **Added** | Partial unique index `uq_journal_entries_source (organization_id, source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL` (migration `JournalEntrySourceUniqueness1786081000000`) so a retried invoice/bill creation can never double-post its journal entry; the existing org+source index stays as the plain lookup index |
| 21 | Trial balance in Phase 3 | **Added** | Minimal read-only `GET /trial-balance` (per-account opening/activity/closing + `balanced` flag over POSTED entries) landed now to validate the posting engine and surface journal_lines schema gaps cheaply; pretty GL/P&L reports remain Phase 8 |
| 22 | DMS field-sales source | **Added** | Root file `dms_routes_outlets_reference` is the canonical source for the DMS field-sales layer: `outlets`, `routes`, `outlet_routes`, `route_assignments`, `outlet_visits`. These land as a dedicated DMS phase (§9) ahead of generic inventory/sales — they have no dependency on orders/invoices and are the DMS's differentiator |
| 23 | Outlet vs Party | **Separate `outlets` table** | An outlet is the customer-facing (field-sales) view; `parties` (accounting) remains the financial record. `outlets.party_id` links to a customer `party` (created automatically on outlet create when not provided). Keeps field GPS/channel/category data off the accounting core |
| 24 | DMS phase ordering | **Dispatch is order-fulfillment, not vehicle tracking** | Per spec's biggest recommendation: Orders → Allocation → Picking → Packing → Loading → Delivery → POD → Returns. Dispatch groups multiple allocated orders into one delivery run (vehicle + driver + stops); it is NOT live vehicle tracking. Live GPS tracking stays P1 |
| 25 | Dispatch sequence | **`dispatch_number` via `document_sequences`** | Each dispatch run gets a gov-compliant sequential number (FY + branch scoped), reusing the Phase 3 document-sequence engine like invoices |
| 26 | POD & offline-first design | **Field ops built offline-friendly from the start** | Check-in/out, delivery confirmation, POD (signature/photo/GPS/notes) are captured on-device first, synced later. Server accepts bulk/queued POSTs; `photo_key`/`photo_url` fields store references so photos can upload async. Live tracking deferred |
| 27 | Visit geometry | **Haversine distance + `is_off_route`** | Check-in computes `distance_from_outlet_meters` via haversine; `is_off_route` flag when outside a configurable tolerance. Enables honest salesman performance later without live tracking |
| 28 | HR approval hierarchy | **`users.manager_id` self-FK** | A manager is the requester's `manager_id`, verified in the service; the `manager` base role grants the permission. No org-chart table in MVP (§16) |
| 29 | Leave balance model | **Annual BS-calendar-year grant** | `leave_balances` keyed by `bs_year` (Baisakh–Chaitra), not the statutory accounting FY; no monthly accrual, no holiday calendar in MVP. Approval consumes balance; reject/cancel never does (§16.2) |
| 30 | Expense → accounting order | **Posting is Phase C3, last** | Approved travel expense claims post an expense journal (per-category COA expense accounts, credit employee AP/petty cash) via Phase 3 machinery, after the workflows exist (§16.4) |
| 31 | Expense claim approval chain | **Manager approves, accountant pays** | Manager (claimant's `manager_id`) approves/rejects the claim (`hr.expense.approve`); the accountant performs the final review + reimbursement with `hr.expense.pay`, transitioning `APPROVED → PAID`. Both steps recorded in `approval_events` (§16.3) |
| 32 | Travel request approval | **Manager-only, same hierarchy as leave** | Travel requests reuse `users.manager_id`; no multi-level chain. Only the expense claim gets the extra finance step (decision 31) (§16.3) |
| 33 | Claim totals | **Always derived from items, never client-supplied** | `travel_expense_claims.total` is recomputed in-txn as the sum of item amounts on every item add/update/delete; at pay the accountant may adjust per-item `approved_amount`, and the total is re-derived (§16.3) |
| 34 | Attendance model | **Single open record per user, BS-date reports** | `attendances` (org, user, `bs_date`, check-in/out times + optional GPS/remarks, `source DEVICE|MANUAL`, derived `duration_minutes`). One OPEN record per user enforced by a partial unique index; check-out optional and must be after check-in. Reports keyed by BS date; employee self-service, manager corrections via `hr.attendance.adjust` (service verifies the employee is a reportee) (§16.5) |
| 35 | Sales targets | **Config now, achievement deferred to Phase 6** | `sales_targets` keyed to salesperson + BS month with `target_type PERSONAL|CATEGORY|BRAND`; category/brand are optional breakdown refs on top of the personal goal, uniqueness per (org, user, period, type, coalesced ref) via a functional unique index. Salesman read-only (`sales.target.read`); manager/admin create/adjust/delete (`sales.target.*`). Achievement % is not computed until sales invoice/order lines exist (Phase 6) and can be attributed to salesperson → category/brand (§9.4) |
| 36 | Inventory MVP scope | **Quantity-only, GRN/invoice flows deferred** | `inventory_locations` (godown/van/shop), `inventory_transactions`(+lines) and `inventory_balances` with `transaction_type` restricted to `opening_stock | stock_adjustment | stock_transfer` for now — purchase-receipt/sales flows get wired when those phases land (engine accepts any `reference_type` later). No batches/FIFO (P1, `batch_tracking`). Unit cost stored per line, no stock valuation. Transfers are atomic source/dest moves; opening stock is once-per-item-and-location; balances never go negative unless `items.allow_negative_stock`; low-stock report (per item/location incl. unstocked reorder items) is read-only for `manager`/`warehouse_manager` (§10) |
| 37 | Sales order MVP scope | **Capture-only: order, no invoice/stock/journal** | `sales_orders`(+lines) are quantity-only capture documents. Status flow `DRAFT → CONFIRMED → COMPLETED` (+ `CANCELED` from DRAFT/CONFIRMED); confirming runs a **warn-only** org-wide stock check (hard enforcement deferred to invoicing) but posts no journal entry and moves no stock. Header `total` is always server-derived (per-line percent discount → line subtotals → header `discount_amount`, floored at 0). Line-level **free goods** (`free_quantity`, shipped + counted against stock via `base_quantity` but never billed) cover the buy-one-get-one FMCG pattern. UOM conversion reuses the inventory rule (org-wide then per-item, `NULLS LAST`). `customer_remarks` carries free-text customer/distributor requests the basic discount system can't model. Salesman creates/reads/updates/confirms/cancels their own orders; `complete` is manager/admin; manager sees reportees via `users.manager_id`; numbers via `document_sequences` (per-org + `sales_order` documentType) (§11.1) |
| 39 | Sales invoice MVP scope | **One order per invoice, per-line partial billing, full IRD/CBMS field model** | `sales_invoices`(+lines) capture from a single CONFIRMED/COMPLETED order per invoice (`sales_order_id` + per-line `source_sales_order_line_id`); per-line billed `quantity` (+ optional `free_quantity`) with the order line's `invoiced_quantity` guarding over-billing. Invoice **number is reserved at POST**, not draft (`INV-` via `document_sequences`, FY+branch scoped) — drafts are numberless and freely editable, `CANCELLED` from DRAFT only, `POSTED` is immutable (corrections deferred to the `sales_returns` credit note → CBMS `billreturn`). Every IRD/CBMS field is stored on the header (taxable/non-taxable/subtotal/discount/tax/excise/hst/esf/export totals, buyer name/address/PAN/VAT snapshot at create — PAN is warn-not-block) with per-line `ird_category` + `tax_rate` snapshots (line override → item `tax_code_id` → first active `TAXABLE` code). Header discount is **pro-rata**: order `discount_amount` × invoiced subtotal ÷ order line sum, capped at invoiced net, editable on drafts. Free goods default to the order line's full free quantity **only when the invoice bills its entire remaining quantity**, else 0. POST runs one atomic txn: AR/VAT journal (DR AR 1103, CR Sales 4101, DR Discounts 4102 when > 0, CR VAT Payable 2102) + stock-out (`sales_invoice` inventory txn from a required `inventoryLocationId`, `base_quantity` incl. free units, `unit_cost` = item standard cost) + order-line `invoiced_quantity` bump (locked `FOR UPDATE`) + `invoices_per_month` plan quota. CBMS push is a **pluggable client** run after commit (Noop dev client → status stays `NOT_REQUIRED`; `IrdCbmsInvoiceClient` stub behind `CBMS_ENABLED=true`; failure → `FAILED` + retryable) and never blocks issuance. Access = owner, admin, or the salesperson's manager; permissions `sales.invoice.{create,read,update,post,void}` (seed v19, salesman all) (§11.2) |
| 40 | Purchase MVP scope | **No PO — direct GRN; direct bill allowed; single-move stock invariant** | `purchase_orders` dropped from MVP (decision — direct GRN entry; PO = P1 sales-order-style capture). `purchase_receipts`/GRN = **stock-in only, no journal** (new `purchase_receipt` inventory txn type, IN, base-uom conversion, requires `inventoryLocationId`, line `unit_cost` from the challan). `purchase_bills` = **journal-only when lines carry `source_purchase_receipt_line_id`** (DR Inventory 1104, DR VAT Receivable 1105, CR AP 2101, CR Discounts Received 5104 when > 0), stock-in itself when lines are direct (single-move rule: stock moves exactly once per goods line, never both). `purchase_returns` = **stock-out + reverse bill journal** (DR AP 2101, CR Inventory 1104, CR VAT Receivable 1105) when sourced from a posted bill line; **stock-out only** when sourced from a GRN line that was never billed (returned quantity must be tracked so a later direct bill can't re-bill it). Numbers `GRN-`/`BILL-`/`DN-` reserved at POST via `document_sequences` (FY+branch scoped), drafts numberless + `CANCELLED` from DRAFT only, `POSTED` immutable; supplier's `vendor_bill_no` stored on the bill. NPR-only: no `exchange_rate`/`is_import`; purchase VAT is **input** (DR 1105), never CR 2102. Perpetual moving-average costing (decision 42): value enters on the bill (DR Inventory 1104), COGS exits on the sales invoice; Purchases 5102 stays in the COA but is not posted in MVP. Permissions `purchase.receipt.{create,read,update,post,void}`, `purchase.bill.*`, `purchase.return.*` (warehouse_manager → GRN, accountant/manager → bill/return); salesman excluded. Status flow mirrors sales invoice (DRAFT→POSTED/CANCELLED; bill paid-state derives from `supplier_payments`, not header status) (§13) |
| 41 | Purchase return before bill | **Allowed — GRN-sourced returns are stock-out-only** | A return may reference either a posted bill line (journal reversal + stock-out) or a GRN line that was never billed (stock-out only, no journal — nothing was posted). Per-GRN-line returned quantity tracked so a later direct bill can't bill returned goods (§13) |
| 42 | COGS valuation | **Perpetual moving-average in MVP** | Pulls "stock valuation" into MVP (overrides decision 16/36's quantity-only stance): `inventory_balances` gains `avg_cost` (decimal). **Value enters on the bill, not the GRN** — the bill (journal-only or direct) reweights `(old_qty×old_avg + in_qty×unit_cost) ÷ new_qty` under the existing `FOR UPDATE` lock; a GRN moves quantity only (line `unit_cost` captured from the challan as seed for the later bill). Stock-OUT moves consume current `avg_cost`: sales invoice, purchase return, and transfer-out (transfer-in carries the source avg into the destination pool). **Sales invoice POST is retrofitted** (shipped, 456 tests): adds DR COGS 5101 / CR Inventory 1104 at `avg_cost` × `base_quantity` **including free units** (free goods have real cost); `issueForSalesInvoice` (inventory.service.ts:294) switches from `item.standardCost` to balances `avg_cost`. Purchase return reverses DR AP / CR Inventory / CR VAT Receivable (not CR Purchases); future sales return reverses DR Inventory / CR COGS. Ledger Inventory 1104 is debited at bill time while physical stock enters at GRN time — an accepted goods-received-before-invoice timing gap that self-corrects once the bill posts. Batches/FIFO stay P1; moving average is the MVP valuation (§11.2, §13) |
| 43 | Purchase TDS | **Per-line, recognized at bill time; 2103 becomes a system-purpose account** | A purchase line carries two independent taxes: its VAT tax code (TAXABLE/EXEMPT) **and** an optional per-line TDS (`tds_tax_code_id` nullable + `tds_rate` + `tds_amount`) — a service line can be both (freight ₹1000 + 13% VAT + 1.5% TDS → pay supplier 1113, remit ₹15). `tds_amount = taxable_amount × tds_rate` (VAT-exclusive base, **after** discount) — **TDS never changes inventory value** (a payable split, not a discount; avg_cost stays `taxable ÷ qty`). Bill journal: DR Inventory Σtaxable, DR VAT Recv 1105 ΣVAT, CR AP 2101 (total − TDS), CR TDS Payable 2103 Σtds; AP + TDS = bill total (JournalService balance guard). Recognized at bill time (Nepal: payment-or-credit-whichever-earlier; AP = amount actually paid, so `supplier_payments` pays exactly AP). `SYSTEM_PURPOSE` gains `TDS_PAYABLE`, 2103 marked in `default-coa`, provisioning seeds per-org TDS codes (1.5% services, 15% professional, 5% rent, 10% interest) with `account_id` → 2103. Return lines snapshot the original `tds_*` so reversals are exact (DR AP net, DR TDS Payable). Remittance = manual journal (DR 2103 / CR Bank) in MVP; TDS-return report by section = Phase 8. Sales invoice **rejects** `TDS_WITHHOLDING` lines (its journal hardcodes CR VAT Payable); `expenses` reuses the same per-line TDS model when it lands (§13) |
| 44 | Sales return MVP scope | **Credit note reversing the invoice at full price** | `sales_returns`(+lines) source posted `sales_invoice_lines`; a line reverses the source line's snapshotted unit price/VAT/`cogs_unit_cost` at full price (the money-side mirror of decision 43 returns). `returned_quantity` accumulates per source line (`remaining = base − returned`, `≤ 0` → `SALES_RETURN_NO_REMAINING`), so partial returns are allowed and the invoice can never be over-returned. `CN-` reserved at POST (FY+branch doc sequences), drafts numberless/`CANCELLED`-only, `POSTED` immutable. POST atomically posts the reverse journal (CR AR 1103 + party / DR Sales 4101 / DR VAT Payable 2102 / DR Inventory 1104 / CR COGS 5101 at the `cogs_unit_cost` snapshot), re-enters stock (`sales_return` IN inventory txn at the invoiced avg cost), stamps the source line, and decrements the invoice's `balance_amount` — source lines + invoices locked FOR UPDATE so a concurrent receipt can never collect against returned amount (§11.3) |
| 45 | Customer receipt MVP scope | **Allocated partial payments, no advances** | `customer_receipts`(+`customer_receipt_allocations`) allocate a paid amount across one or more posted `sales_invoices`; `received_amount` is always the server-derived Σ of allocations (pre-payments/advances are out of MVP scope). `RCV-` reserved at POST (FY+branch doc sequences), drafts numberless/`CANCELLED`-only, `POSTED` immutable. POST re-validates each invoice FOR UPDATE (POSTED, same customer, allocated ≤ live `balance_amount`), posts DR receipt account (active, non-group ASSET) / CR AR 1103 (party), and stamps `paid_amount`/`balance_amount` — the money-in mirror of `supplier_payments` (decision 40) (§11.4) |

## 3. Target Backend Structure

```
neos_dms_backend/src/
  main.ts, app.module.ts
  config/            env.validation.ts, configuration.ts (typed via @nestjs/config + class-validator)
  database/          data-source.ts, migrations/, seeders/, base.entity.ts
  common/            decorators/ guards/ interceptors/ filters/ pipes/ dto/ enums/
  modules/
    tenant/          modules (catalog only), organizations, branches
    subscription/    plans (with `limits` jsonb), billing_periods, price_matrices,
                     subscriptions, organization_usages, subscription_transactions, subscription_history
    iam/             users, roles, permissions, role_permission_mappings, audit_logs, auth
    trading/         items, item_categories, uoms, uom_conversions, brands
    field/           outlets, routes, outlet_routes, route_assignments, outlet_visits (DMS §9)
    dispatch/        vehicles, dispatches, dispatch_stops, dispatch_documents (DMS §12)
    inventory/       locations, inventory_transactions, inventory_balances
    sales/           sales_orders, sales_invoices, sales_returns, customer_receipts
    purchase/        purchase_orders, purchase_receipts (GRN), purchase_bills, purchase_returns,
                     supplier_payments
    accounting/      fiscal_years, fiscal_periods, currencies, payment_terms, payment_methods,
                     accounts, parties, party_addresses, tax_types, tax_codes, tax_templates,
                     journal_entries, journal_lines, document_sequences, transaction_types
  nepali-date/       existing module (AD/BS conversion, BS month calendar)
```

Convention: each module = `*.module.ts`, `*.controller.ts`, `*.service.ts`, `entities/`, `dto/`, `*.spec.ts`. Colocate entities with features; migrations centralized in `src/database/migrations`.

> **Removed vs reference:** `verticals`, `vertical_module_mappings`, `plan_module_mappings`, `variant_attributes` (P1), `exchange_rates` (P1), `attachments` (P1), `transaction_tags`/`journal_entry_tags` (P1), `inventory_serials`/batch/serial junction tables (dropped/P1), `cheques`, `landed_cost_*` (P1), 7 allocation chains → 2 allocation tables.

## 3.1 FMCG MVP Scope — P0 / P1 / Drop

> Priority rationale: an FMCG distributor's daily loop is **salesmen take orders → warehouse ships from stock → invoices → customer receipts**, and **purchase → GRN → bills → supplier payments**. Stock and money must move in the same transaction as the journal posting. The accounting **engine** (COA, journal, tax, fiscal year, doc sequences) is built early and NPR-only; non-core vertical features are cut or deferred.

**P0 — MVP (build now):**
- Tenant: `modules` (permission catalog), `organizations`, `branches`
- Subscription: `plans` (+`limits`), `billing_periods`, `price_matrices`, `subscriptions`, `organization_usages`, `subscription_transactions`, `subscription_history`
- IAM: `roles`, `permissions`, `role_permission_mappings`, `users`, `audit_logs` + auth
- Trading masters: `item_categories`, `uoms`, `brands`, `items`, `uom_conversions` (case↔piece is core FMCG)
- **DMS field sales (new, §9):** `outlets`, `routes`, `outlet_routes`, `route_assignments`, `outlet_visits` (source: root `dms_routes_outlets_reference`)
- **DMS dispatch (new, §12):** `vehicles`, `dispatches`, `dispatch_stops`, dispatch documents (pick list / loading sheet / POD) — order-fulfillment run, not live GPS
- Inventory: `inventory_locations`, `inventory_transactions`, `inventory_balances` (quantity only)
- Sales/AR: `sales_orders`(+lines), `sales_invoices`(+lines), `sales_returns`(+lines) credit-note flow, `customer_receipts`(+lines + invoice allocations)
- Purchase/AP: `purchase_orders`(+lines), `purchase_receipts`/GRN(+lines), `purchase_bills`(+lines), `purchase_returns`(+lines), `supplier_payments`(+lines + bill allocations), `expenses`(+lines)
- Accounting engine: `fiscal_years`, `fiscal_periods`, `currencies` (NPR base), `payment_terms`, `payment_methods`, `accounts` (+default COA seed), `parties`, `party_addresses`, `tax_types`, `tax_codes`, `tax_templates`, `journal_entries`, `journal_lines`, `document_sequences`, `transaction_types`
- Core reports: trial balance, P&L, AR aging, stock report

**P1 — quick follow-on (same fiscal cycle, out of MVP):**
- `sales_quotations`(+lines), `inventory_batches`(+balances) for expiry, `variant_attributes`, `exchange_rates`, `attachments`, `transaction_tags`/`journal_entry_tags`, `cheques`, `landed_cost_*`, dedicated GRN merge, offline sync layer, dashboards
- DMS P1: live GPS vehicle tracking, route optimization (TSP/visits), retailer mobile app push/SMS, salesman performance & incentive calc

**Drop (not FMCG):**
- `verticals`, `vertical_module_mappings` (already), `inventory_serials` (+ batch/serial junction tables — electronics), restro/pharma/retail features

**Cut-lines — resolved in favor of MVP:** `sales_returns` (credit-note flow) and `expenses` are **in MVP** — damage/expiry returns and petty expenses are daily FMCG reality, and both feed the journal engine.

## 4. Cross-Cutting Foundation (Phase 0)

- [x] Typed env config with validation (`@nestjs/config` + class-validator), fails fast on missing vars
- [x] `TypeOrmModule.forRootAsync`, data-source for CLI, `src/database/migrations/`
- [x] Global `ValidationPipe` (whitelist, transform, forbidNonWhitelisted), DTOs everywhere
- [x] Global exception filter — structured `{ status, code, message, details, requestId }`
- [x] Request-ID + response envelope interceptor; structured logging (Pino optional)
- [x] Swagger/OpenAPI mounted at `/api/v1/docs`
- [x] `src/common/` building blocks: `BaseEntity` (id, timestamps, audit cols), pagination DTO, `CurrentUser`/`CurrentTenant` decorators
- [x] Base roles + permission codes seed strategy (seeds versioned, idempotent) — mechanism + permission-code catalog shipped; role data seeding lands in Phase 2 with the IAM tables
- [x] Unit + e2e test harness; `npm run lint` / `npm test` green on CI
- [x] README for backend (run, migrate, seed, test) + commit conventions

## 5. Phase 1 — Tenant & Subscription System

DB ordering note: migrations 2 & 3 reference `organizations`, `modules`, `branches` — these tenant tables come from migration 1, so the **schema baseline is created foundation-first** even though operational features land in later phases.

### 5.1 Tenant scaffolding (from migration 1, simplified)
- [x] Entities + migration: `modules`, `organizations`, `branches`
- [x] `verticals` / `vertical_module_mappings` not created (single vertical: General Trade)
- [x] Seeded modules (catalog for permission codes only — **not** a subscription gate): `trading`, `sales`, `purchase`, `inventory`, `accounting`, `reports`, `dispatch` (+ `tenant`, `subscription`, `iam` added by the Phase 2 seed)
- [x] Org onboarding hook: creates org + main branch + **default trial subscription** (+ in Phase 3, default COA — backfilled idempotently for pre-existing orgs by seed)

### 5.2 Subscription model — usage & seats, NOT module gating

**Why:** every FMCG plan needs the full order→invoice→stock flow to be usable. Plans differ by **scale**, not by module availability. So a plan is a *limit profile*, and module availability is not restricted.

**Limit kinds (enumerated in code, not DB):**

| Kind | Meaning | Examples | Enforcement |
|---|---|---|---|
| `seat` | Absolute cap, counted live | `users`, `branches`, `items` | `COUNT` in the create transaction (small scale; no drift) |
| `periodic` | Cap per billing period | `invoices_per_month`, `orders_per_month`, `purchase_receipts_per_month` | Atomic counter in `organization_usages`, auto-reset on period rollover |
| `feature` | Boolean flag | `multi_branch`, `batch_tracking`, `cheques`, `landed_cost`, `offline` | Read-only check; drives UI + service guards |

New limit dimension later = add a key to plan seeds + the code enum; **no schema change** — this is the anti-derail lever.

- [x] Entities + migration: `plans`, `billing_periods`, `price_matrices`, `subscriptions`, `organization_usages`, `subscription_transactions`, `subscription_history`
- [x] `plan_module_mappings` **not created** (replaced by `plans.limits` jsonb)
- [x] `plans.limits` jsonb — canonical limit profile, e.g.
      `{"users": 5, "branches": 1, "items": 500, "invoices_per_month": 1000, "orders_per_month": 1000, "purchase_receipts_per_month": 500, "multi_branch": false, "batch_tracking": false, "offline": false}`
- [x] `plans.code` (unique, stable slug: `starter`/`growth`/`enterprise`) for rename-safe system refs; seed base plan profiles (single General Trade vertical, price per billing period, no vertical dimension)
- [x] `price_matrices` — unique price point `(plan_id, billing_period_id)`; append-only/versioned (price history preserved)
- [x] `subscriptions` — partial unique index: at most one `trialing`/`active`/`past_due` per `organization_id`; price lock via `amount`/`currency`/`billing_period_id` snapshot; CHECK on `status` (`trialing|active|past_due|canceled`); store `grace_period_end` for past_due→canceled
- [x] `organization_usages` — `(organization_id, resource_code)` unique; holds periodic counters with `current_usage` + `last_reset_at`; seat limits NOT stored here (computed live)
- [x] `subscription_transactions` — `gateway_transaction_id` UNIQUE (eSewa/Khalti webhook idempotency), `paid_at`, CHECK on `status`
- [x] `subscription_history` — `changed_by` + `reason` (self-contained state timeline)
- [x] `SubscriptionService` — lifecycle `trial → active → past_due → canceled`, period rollover, grace scheduler
- [x] `PlanLimitService` — enforcement primitives:
  - [x] `assertSeat(orgId, code)` — `COUNT` vs `plans.limits` inside the caller's transaction (also accepts an `EntityManager`)
  - [x] `consumePeriodic(orgId, code)` — single atomic `UPDATE organization_usages SET current_usage = CASE WHEN last_reset_at < $periodStart THEN 1 ELSE current_usage + 1 END, last_reset_at = $periodStart WHERE organization_id = $1 AND resource_code = $2 AND (last_reset_at < $periodStart OR current_usage < $limit) RETURNING id` — **no row back = exceeded** (no scheduler, race-safe)
  - [x] `assertFeature(orgId, code)` — boolean check
- [x] `@PlanLimit(code)` method decorator (interceptor): reads tenant from CLS → asserts → runs → on success consumes; throws `PLAN_LIMIT_EXCEEDED` with `{ resource, limit, current }` (UI uses this to upsell)
- [x] Endpoints: plan catalog (public), org subscription (create/change/cancel), **usage snapshot** (current vs limit per resource), history, webhook hook point for billing
- [~] Adapters to consume limits at call sites: user create → `users` seat **done (Phase 2)**; invoice/order/GRN create → periodic counters land with those phases

**Acceptance:** new org gets trial subscription; `users`/`invoices_per_month` etc. enforced at service layer with a structured `PLAN_LIMIT_EXCEEDED` error; counters reset on period rollover without a cron; org can never hold two active subscriptions; gateway callbacks are idempotent (replay-safe).

## 6. Phase 2 — User & Access Control (IAM + RBAC)

### 6.1 Tables (from migration 3)
- [x] Entities + migration: `roles`, `permissions`, `role_permission_mappings`, `users`, `audit_logs`
- [x] Permission codes as granular `Module.Action` (e.g. `accounting.journal-entry.create`), **not** hardcoded roles (spec requirement) — `src/database/seeders/permissions.ts` (70 codes, 10 modules) seeded + idempotently ensured at runtime
- [x] Seed base roles from spec: `ADMIN`, `ACCOUNTANT`, `SALESMAN`, `DRIVER`, `WAREHOUSE_MANAGER` + permission mappings (in-txn at onboarding + idempotent backfill seed for pre-existing orgs; `admin` is superuser by code)
- [~] Seed `audit_logs` trigger points for every business event (spec requirement) — `AuditService` wired for auth/IAM flows; remaining business events land with their phases

### 6.2 Auth + RBAC plumbing
- [x] JWT auth (access + refresh with rotation), bcrypt, login/register (org onboarding + owner ADMIN in one txn; no email invite — temp password → forced change)
- [x] `JwtAuthGuard` (global) + `PermissionsGuard` + `@RequirePermission(...)` decorator; `@Public()` escape hatch
- [x] Admin = `SUPERUSER_ROLE_CODE` bypass; fine-grained via per-request permission resolution (no stale JWTs); single-role-per-user MVP
- [x] Tenancy: org scoping via CLS (`req.tenant` from the token) on every request
- [x] User create/enable enforces the `users` seat limit via `PlanLimitService.assertSeat` (inside the same transaction)
- [x] `AuditService` — records actor, action, entity, before/after, ip, occurred_at (BS/AD dual timestamp)
- [x] Endpoints: users CRUD, roles CRUD, permissions list, role-permission mapping, audit log query (paginated)

**Acceptance:** login issues JWT; role with `sales.*` perms can't hit `accounting.*`; every mutation is audited. **Verified live:** register → login → `/auth/me` (admin + all 70 perms) → refresh rotation (old token → `REFRESH_TOKEN_REVOKED`) → audit query with BS dates → seat limit (`PLAN_LIMIT_EXCEEDED` at 5/5) → RBAC (`FORBIDDEN` for salesman on `/users`).

## 7. Phase 3 — Accounting Engine (FMCG subset, NPR-only)

The posting engine that sales/purchase/inventory post into. Reuses `nepali-date` for dual dates + Nepali fiscal year (Shrawan 1 start — the statutory IRD fiscal year; the 12 periods run Shrawan→Chaitra of `bsYear` then Baisakh→Ashadh of `bsYear+1`). Deferred to P1: `exchange_rates`, `attachments`, `transaction_tags`/`journal_entry_tags`.

- [x] `fiscal_years`, `fiscal_periods` — one active FY per org (partial unique index), BS + AD date range; open/close workflow with period lock + audit
- [x] `currencies` — NPR base seed; `exchange_rates` NOT created in MVP
- [x] `payment_terms`, `payment_methods`
- [x] `accounts` — hierarchical chart of accounts (level/path), system-purpose accounts; **default COA seeded per org on creation** (idempotent backfill for existing orgs via versioned seed)
- [x] `parties`, `party_addresses` — customer/supplier/lead (CHECK at-least-one-role), payment terms
- [x] `tax_types`, `tax_codes`, `tax_templates` — VAT 13% / TDS seeds, `math_sign IN (1,-1)` CHECK
- [x] `journal_entries` + `journal_lines` — balanced double-entry; debit/credit mutual-exclusion CHECK; posting in a transaction; `transaction_types` as seeded constants
- [x] `document_sequences` — fiscal-year-scoped, branch-safe sequential numbering (gov-compliant invoices) with prefix, atomic upsert via `doc_seq_unique` ON CONFLICT
- [x] Minimal trial-balance read (POSTED entries; per-account opening/activity/closing + `balanced` flag) — Phase 3
- [ ] Core reports foundation: general ledger, P&L (deferred to Phase 8)
- [x] Fiscal year open/close workflow
- [x] Tenancy onboarding provisions accounting in the same txn; `POST /api/v1/accounting/provision` for idempotent re-provision

**Verified (2026-08-07):** migration `AccountingEngine1786070270761` applied against live Postgres; seeds 7–9 applied (tax types/templates, transaction types, per-org accounting backfill); both existing orgs have 31-account COA + active FY 2083/84 with 12 periods + VAT/exempt tax codes + global NPR currency; unit tests added for every accounting service (accounts, parties, fiscal years, document sequences, taxes, provisioning, journal posting, provisioning logic) — `npm run lint` clean, **151 unit tests pass**. Tax schema tightened with migration `TaxCodeUniqueness1786072881892` (unique `tax_codes (organization_id, name)` + unique `tax_templates (name)`), applied + duplicate-insert rejection verified against live Postgres.

**Phase 3 review follow-ups (2026-08-07):** fiscal-year basis corrected from Baisakh 1 to the statutory **Shrawan 1** (decision 19) with `FixFiscalYearShrawanBasis1786080000000` rebuilding existing orgs' FYs (FY `2083/84` now = 2026-07-17 → 2027-07-16); partial unique index `uq_journal_entries_source` added (decision 20, migration `JournalEntrySourceUniqueness1786081000000`) to make double posting impossible; minimal trial-balance read landed (decision 21, `GET /trial-balance`, guarded by `accounting.journal-entry.read`). **158 unit tests pass**, lint + build clean, both new migrations applied + verified against live Postgres.

**Acceptance:** double-entry posting rejects unbalanced entries; invoice numbers unique per FY; default COA exists for every org; reports tie to journal lines.

## 8. Phase 4 — Trading Masters (FMCG core)

- [x] `item_categories`, `uoms`, `brands`, `items` (SKU, base UOM, default price, tax template, reorder level)
- [x] `uom_conversions` — case ↔ piece conversion (critical for FMCG; `factor` + CHECK factor > 0)
- [x] Enforce `items` seat limit on item create
- [x] Endpoints: items CRUD, categories, brands, UOM + conversions

**Acceptance:** an item can be sold/invoiced in cases and stocked in pieces; conversions are unit-safe.

## 9. DMS Phase A — Field Sales: Outlets, Routes & Visits

> **Source:** root file `dms_routes_outlets_reference` (canonical column list). This is the DMS differentiator and has **no dependency** on inventory/orders — it can be built immediately on top of trading masters + IAM users + accounting parties.

### 9.1 Tables (from `dms_routes_outlets_reference`)

- [x] `outlets` — org-scoped; `party_id` FK → `parties` (customer party, created in-txn when not provided); fields: `name`, `owner_name`, `email`, `phone`, `address`, `province`, `district`, `latitude`, `longitude`, `photo_key`, `description`, `channel` (`general_trade|modern_trade|horeca|institution`), `category`, `status` (`active|inactive`)
- [x] `routes` — org-scoped; `name`, `code` (unique per org), `description`, `province`, `district`, `status`
- [x] `outlet_routes` — junction (org, outlet_id, route_id); one outlet can sit on multiple routes, one route has many outlets
- [x] `route_assignments` — (org, user_id, route_id) a **salesman** (user) owns a route for a set of `weekdays[]` (e.g. `[1,3,5]`); partial unique to keep one active assignment per route
- [x] `outlet_visits` — (org, user_id, route_id, outlet_id); `visit_type` (`planned|unplanned`), `status` (`scheduled|checked_in|checked_out|completed|cancelled`), `checked_in_at`/`checked_out_at`, check-in/out lat/long, `distance_from_outlet_meters`, `is_off_route`, `remarks`, `photo_key`

### 9.2 Key behaviors
- [x] Outlet create auto-provisions a customer `party` (same txn, `is_customer = true`) unless `party_id` supplied — single source of truth for receivables stays in accounting
- [x] Visit check-in validates: user is assigned to the route (`route_assignments`), outlet is on the route (`outlet_routes`); computes haversine `distance_from_outlet_meters` + `is_off_route` (> configurable tolerance, e.g. 200 m)
- [x] Check-out finalizes visit; visit completed on check-out; audit every check-in/check-out (`AuditService`)
- [ ] Photo upload: store `photo_key` (S3/disk key) only; binary upload endpoint returns a key (P1 async upload)
- [x] `GET /outlets/mine` + `GET /routes/mine` — salesman sees only their assigned routes + outlets (RBAC-scoped reads)
- [x] Bulk outlet import for legacy-system migration: `POST /outlets/import` (xlsx/csv with delimiter auto-detection, per-row error report with spreadsheet row numbers, in-file + existing-org duplicate skip, savepoint-batched single txn, 10k row cap, 10 MB file cap) + `GET /outlets/import/template` (xlsx template with `Outlets` sheet + `Instructions` sheet); requires `sales.outlet.create`; `sales.outlet.import` audit; legacy `.xls` rejected with clear message. Query options: `dryRun=true` (validate-only, zero writes, same report), `mode=update` (update existing outlets in place instead of skipping — name/status never overwritten, customer party email/phone/address kept in sync), `format=csv` (download the failed rows as a CSV with an `error` column to fix offline and re-upload only those)

### 9.3 API + permissions
- [x] `outlets` CRUD → `sales.outlet.{create,read,update,delete}` (resource under module `sales`)
- [x] `routes` CRUD → `sales.route.{create,read,update,delete}`
- [x] `outlet_routes` assign/remove → `sales.route.update`
- [x] `route_assignments` assign/remove salesman+weekdays → `iam.user.update`
- [x] `visits` check-in/check-out/list → `sales.visit.{create,read,update}`; salesman can write their own, managers/all
- [x] Seed: add the new permission codes (bump seed version) + extend `salesman` role with `sales.outlet.*`, `sales.route.*`, `sales.visit.*`; `warehouse_manager`/`admin` get read

**Acceptance:** salesman sees only their routes/outlets; check-in rejects off-route/unauthorized users; outlet create makes a usable customer party; every visit transition is audited. — **Verified**: live smoke (`neos_dms_backend/smoke.js`) covers the full chain incl. RBAC 403s and duplicate/off-route negatives; 49 real-DB integration tests in `src/field/*.service.spec.ts` (harness: `src/testing/` — real Postgres on :5433, per-test transaction rollback). Outlet bulk import verified via live curl smoke (xlsx + csv): valid rows import with auto-provisioned parties, in-file duplicates skipped, per-row validation errors reported with row numbers, `sales.outlet.import` audited — plus `dryRun=true` (previews without writes), `mode=update` (updates existing outlet + customer party in place), `format=csv` (downloadable error file), and semicolon/pipe CSV delimiter auto-detection all smoke-tested; 306 backend tests pass (12 import-focused).

### 9.4 Sales targets (config; achievement = Phase 6)
- [x] `sales_targets` CRUD → `sales.target.{create,read,update,delete}`; salesman granted only `sales.target.read` (own targets), manager/admin full
- [x] Rows keyed to salesperson + BS year/month; `target_type` PERSONAL | CATEGORY | BRAND with optional `category_id`/`brand_id` refs; per-(org,user,period,type,ref) uniqueness via functional unique index
- [x] Monthly BS report (scope `mine`/`team`/`all`, team via `manager_id`) grouping each user's personal target + category/brand breakdowns
- [ ] Achievement % computed once sales invoices/orders exist (Phase 6) — attribute invoice lines to salesperson → item category/brand and compare against `sales_targets.amount` (decision 35)

## 10. Phase 5 — Inventory (quantity-based, no batches in MVP)

> **Implemented (decision 36):** quantity-only MVP. `inventory_locations` (godown/van/shop), `inventory_transactions`(+lines) and `inventory_balances` land now; GRN/invoice wiring is deferred — the engine accepts any `reference_type` when purchase/sales phases land.

- [x] `inventory_locations` (godown / van / shop, default per org), `inventory_transactions`(+lines) with `transaction_type` (`opening_stock | stock_adjustment | stock_transfer`), `inventory_balances` (per location × item, materialized with `FOR UPDATE` locking)
- [x] Flows: **opening stock** (once per item × location), **stock adjustment** (IN default / OUT), **stock transfer** (atomic ±source/dest in one DB txn); all moves post a transaction number via `document_sequences` (`opening_stock`-scoped) and an audit row
- [x] Balance constraint: OUT below available stock rejected unless `items.allow_negative_stock`; balances never go negative for normal items
- [x] UOM conversion on moves: base-quantity derived through `uom_conversions` (org-wide then per-item, `NULLS LAST`); opening/transfer/adjust all convert to base UOM
- [x] Low-stock report `GET /inventory/balances/low-stock` — per item × location where on-hand ≤ reorder (includes unstocked active reorder items at 0); read-only for `manager`/`warehouse_manager`; balances readable only by those roles (no salesman/driver read)
- [x] `batch_tracking` feature flag gates future P1 batch columns (no schema churn now); unit cost per line, no stock valuation; purchase/sales-reference flows wired in Phases 6/7

**Acceptance:** every stock in/out is an `inventory_transaction`; balance is derived & consistent; negative stock impossible except flagged items; low-stock report correct with parenthesized OR guard (SQL precedence fix in service).

## 11. Phase 6 — Sales & AR

- [x] `sales_orders`(+lines) — order by SALESMAN, status flow (draft → confirmed → completed / canceled) — **done (decision 37, §11.1)**
- [x] `sales_invoices`(+lines) — creates journal entry (AR ↔ Sales Income + VAT) + stock out + doc sequence number, all in one transaction; `invoices_per_month` limit consumed — **done (decision 39, §11.2)**
- [x] `sales_returns`(+lines) — credit note flow, reverses journal + stock — **done (decision 44, §11.3)**
- [x] `customer_receipts`(+lines + `customer_receipt_invoice_allocations`) — partial payments against invoices; posts to journal — **done (decision 45, §11.4)**
- [ ] FKs replace the reference's order→invoice→return allocation chains (Decision 15)

**Acceptance:** invoicing posts balanced journals, decrements stock, consumes invoice quota atomically; partial payments allocate correctly; invoice number unique per FY.

### 11.1 Sales orders (capture) — implemented (decision 37)

- [x] `sales_orders` + `sales_order_lines` — `order_number` (via `document_sequences`), `party_id` (accounting `parties`, `is_customer`), `salesperson_id`, `branch_id`, `bs_date` (server Nepali date), `status`, `total` + `discount_amount` (header fixed NPR), `notes`, `customer_remarks`
- [x] Line model: `quantity` (billed) + `free_quantity` (shipped, never billed) + `base_quantity` (sell→base uom conversion incl. free units) + `unit_price` (defaults to `item.sale_price`) + `discount_percent` + `line_total`; `quantity > 0 OR free_quantity > 0` enforced
- [x] Discount stacking: per-line `discount_percent` first, then header `discount_amount`; total floored at 0; all totals server-derived
- [x] Status flow `DRAFT → CONFIRMED → COMPLETED` and `CANCELED` from DRAFT/CONFIRMED; `CONFIRMED` cannot be edited; re-confirm/complete guarded (`SALES_ORDER_INVALID_TRANSITION`)
- [x] Warn-only stock check on confirm — org-wide on-hand vs shipped `base_quantity` (free units included); returns `stockWarnings`, never blocks
- [x] UOM conversion identical to inventory (org-wide then per-item `NULLS LAST`); missing conversion → `SALES_ORDER_UOM_CONVERSION_NOT_FOUND`
- [x] Access scoping: salesman owns docs (`mine`); manager sees + orders for reportees via `users.manager_id` (`team`); admin unrestricted (`all`); `complete` requires manager/admin
- [x] Permissions: `sales.order.{create,read,update,confirm,cancel,complete}` — salesman grants all but `complete`; manager/admin via `sales.*` glob; seed v18 `sales-order-permissions-backfill`
- [x] Audit row on every mutation (`sales.order.*` actions, entityType `sales_order`)
- [x] Migration `1786600000000-SalesOrder.ts` + entity/DTO/service/controller (routes: `POST/GET /sales/orders`, `GET/PATCH /sales/orders/:id`, `POST /sales/orders/:id/{confirm,complete,cancel}`, `GET /sales/orders/{mine,team,all}`)
- [x] Invoicing — **implemented in §11.2 (decision 39)**

### 11.2 Sales invoices (per-order partial billing) — implemented (decision 39)

- [x] `sales_invoices` + `sales_invoice_lines` — `invoice_number` (`INV-` via `document_sequences`, FY+branch scoped, **reserved at POST not draft**), `sales_order_id`, `party_id`, `salesperson_id`, `branch_id`, `status` (`DRAFT → POSTED` / `CANCELLED` from DRAFT only), AD+BS `invoice_date`/`due_date` (due days from party payment term), full IRD/CBMS totals (`taxable_total`, `non_taxable_total`, `subtotal`, `discount_total`, `tax_total`, `rounding_adjustment`, `total`, `excisable_amount`, `excise_total`, `hst_total`, `esf_total`, `export_total`, `paid_amount`, `balance_amount`), buyer snapshot (`buyer_name/address/pan/vat`), `fiscal_year_id`, `journal_entry_id`, `inventory_transaction_id`, CBMS tracking (`cbms_status`, `cbms_reference`, `cbms_error`), print counters
- [x] Line model: `source_sales_order_line_id` + `quantity` (billed) + `free_quantity` + `base_quantity` (sell→base uom incl. free units) + `unit_price` (defaults to order line price) + `discount_percent`/`discount_amount` + `tax_code_id`/`ird_category`/`tax_rate` snapshot + `taxable_amount`/`tax_amount`/`line_total`; tax resolution = line override → item `tax_code_id` → first active `TAXABLE` code
- [x] Partial billing: order line `invoiced_quantity` (`chk_sales_order_lines_invoiced`) locks `FOR UPDATE` and rejects over-billing (`SALES_INVOICE_QUANTITY_EXCEEDED`); drafts re-validate remaining at POST; one invoice can bill any subset of a confirmed order's lines
- [x] Pro-rata header discount: `order.discount_amount` × invoiced subtotal ÷ order line sum, capped at invoiced net, editable on drafts; free goods default to the order line's full free quantity only when the invoice bills its entire remaining quantity, else 0
- [x] POST transaction: AR/VAT journal (DR AR 1103 + party, CR Sales 4101, DR Discounts 4102 when > 0, CR VAT Payable 2102; branch fallback invoice→order→first active) via manager-scoped `JournalService.createDraftIn`/`postIn` + stock-out (`sales_invoice` inventory txn, direction OUT, `base_quantity` incl. free units, `unit_cost` = item standard cost, from the required `inventoryLocationId`) + `invoiced_quantity` bump + `PlanLimitService.consumePeriodic('invoices_per_month')` — all atomic, `@PlanLimit` decorator not used. **Retrofitted (decision 42):** POST now also posts **COGS** — DR COGS 5101 / CR Inventory 1104 at `inventory_balances.avg_cost` × `base_quantity` (incl. free units) — and `unit_cost` for the stock-out txn comes from `avg_cost`, not `item.standardCost` (shipped, §13)
- [x] CBMS: pluggable client (interface + `CBMS_INVOICE_CLIENT` token) — `NoopCbmsInvoiceClient` default (skipped → `NOT_REQUIRED`), `IrdCbmsInvoiceClient` stub behind `CBMS_ENABLED=true`; push runs **after commit**, sets `PUSHED`/`FAILED`/`NOT_REQUIRED`, never blocks issuance
- [x] Permissions: `sales.invoice.{create,read,update,post,void}` — salesman all (via `sales.invoice.*`), manager/admin via `sales.*`; seed v19 `sales-invoice-permissions-backfill`
- [x] Access scoping: owner, admin, or the salesperson's manager; `mine` / manager `team` (via `manager_id`) / admin `all`
- [x] Audit row on every mutation (`sales.invoice.*` actions, entityType `sales_invoice`)
- [x] Migration `1786700000000-SalesInvoice.ts` + entity/DTO/service/controller (routes: `POST/GET /sales/invoices`, `GET /sales/invoices/{mine,team,all}`, `GET/PATCH /sales/invoices/:id`, `POST /sales/invoices/:id/{post,void}`); `journal_entries`/`inventory_transactions` gain manager-scoped entry points for in-txn callers
- [x] `sales_returns` credit-note flow (reverses journal + stock) — **implemented in §11.3 (decision 44)**

### 11.3 Sales returns (credit notes) — implemented (decision 44)

- [x] `sales_returns` + `sales_return_lines` — `return_number` (`CN-` via `document_sequences`, FY+branch scoped, **reserved at POST not draft**), `party_id`, `branch_id`, `status` (`DRAFT → POSTED` / `CANCELLED` from DRAFT only), AD+BS `return_date`, `fiscal_year_id`, `inventory_location_id`, `journal_entry_id`, `inventory_transaction_id`, full IRD-style totals (`taxable_total`, `non_taxable_total`, `subtotal`, `discount_total`, `tax_total`, `cogs_total`, `total`), `return_reason`, `notes`
- [x] Line model: `source_sales_invoice_line_id` + `quantity` (entry uom, defaults to the full remaining) + `base_quantity` + `unit_price`/`tax_rate`/`cogs_unit_cost` snapshots from the posted invoice line + `gross_amount`/`taxable_amount`/`tax_amount`/`line_total` — a return reverses the original invoice at full price (partial `quantity` allowed)
- [x] Partial-return guard: `returned_quantity` accumulates on the source invoice line (`remaining = base − returned`); `≤ 0` → `SALES_RETURN_NO_REMAINING`, over-quantity → `SALES_RETURN_QUANTITY_EXCEEDED`; non-posted source / wrong customer rejected
- [x] POST transaction: reverse journal (CR AR 1103 + party / DR Sales 4101 / DR VAT Payable 2102 / DR Inventory 1104 / CR COGS 5101 at `cogs_unit_cost`) + stock re-entry (`sales_return` IN inventory txn from the required `inventoryLocationId` at the invoiced avg cost) + source-line `returned_quantity` stamp + invoice `balance_amount` decrement — source lines + invoices locked `FOR UPDATE` (no over-return, no collection against returned amount), all atomic
- [x] Permissions: `sales.return.{create,read,update,post,void}` — salesman all (via `sales.return.*`), manager/admin via `sales.*`; seed `sales-return-receipt-permissions.seed.ts`
- [x] Audit row on every mutation (`sales.return.*` actions, entityType `sales_return`)
- [x] Migration `1787300000000-SalesReturn.ts` + entity/DTO/service/controller (routes: `POST/GET /sales/returns`, `GET/PATCH /sales/returns/:id`, `POST /sales/returns/:id/{post,void}`); `sales_invoice_lines.returned_quantity` column; `inventory_transaction` Check extended with `sales_return`

### 11.4 Customer receipts (money-in) — implemented (decision 45)

- [x] `customer_receipts` + `customer_receipt_allocations` — `receipt_number` (`RCV-` via `document_sequences`, FY+branch scoped, **reserved at POST not draft**), `party_id` (customer), `payment_method_id`, `receipt_account_id` (cash/bank/other asset), `status` (`DRAFT → POSTED` / `CANCELLED` from DRAFT only), AD+BS `receipt_date`, `fiscal_year_id`, `journal_entry_id`, `received_amount` (server-derived Σ allocations — **no advances in MVP**), `reference_no` (cheque/wallet id), `notes`
- [x] Allocation model: one or more `sales_invoice_id`/`allocated_amount` rows; each allocation must reference a **posted** invoice of the **same customer** with a positive amount ≤ the invoice's live `balance_amount`
- [x] POST transaction: invoices re-validated `FOR UPDATE` (POSTED, same customer, allocated ≤ live balance → `SALES_RECEIPT_ALLOCATION_EXCEEDS_BALANCE` otherwise) + journal (DR receipt account / CR AR 1103 + party) + per-invoice `paid_amount`/`balance_amount` stamps — concurrent receipts can never over-collect (Σ allocations = received amount, each ≤ the locked live balance), all atomic
- [x] Receipt account validated at POST: must exist, be active, non-group, `coaType = ASSET` (`SALES_RECEIPT_ACCOUNT_TYPE` otherwise); payment method must be active
- [x] Permissions: `sales.receipt.{create,read,update,post,void}` — salesman all (via `sales.receipt.*`), manager/admin via `sales.*`; seed `sales-return-receipt-permissions.seed.ts`
- [x] Audit row on every mutation (`sales.receipt.*` actions, entityType `customer_receipt`)
- [x] Migration `1787400000000-CustomerReceipt.ts` + entity/DTO/service/controller (routes: `POST/GET /sales/receipts`, `GET/PATCH /sales/receipts/:id`, `POST /sales/receipts/:id/{post,void}`)

## 12. DMS Phase B — Dispatch & Delivery (order fulfillment)

> **Design (decision 24):** dispatch is the **orchestration layer** between sales and delivery — it fulfills **allocated orders**, it is not vehicle tracking. One dispatch = one delivery run (vehicle + driver) carrying several allocated orders as stops. Depends on Phase 5 (inventory) + Phase 6 (orders/invoices). Live GPS tracking deferred to P1.

### 12.1 Tables

- [ ] `vehicles` — org-scoped; `name`, `registration_number` (unique per org), `vehicle_type` (`van|truck|pickup|motorbike`), `capacity_weight_kg`, `capacity_volume_cbm`, `is_active`, `current_driver_id` (nullable FK → users, reassigned per dispatch)
- [ ] `dispatches` — org-scoped; `dispatch_number` (via `document_sequences`, decision 25), `vehicle_id`, `driver_id`, `route_id` (nullable), `status` (`allocated → picking → packed → loaded → in_transit → delivered / cancelled`), `planned_departure_at`, `departed_at`, `completed_at`, `notes`
- [ ] `dispatch_stops` — (dispatch_id, order_id) one stop per order; `stop_sequence`, `status` (`pending|delivered|partial|failed`), `delivered_at`, `failure_reason` (`customer_unavailable|rejected|wrong_address|damaged`), `pod_receiver_name`, `pod_signature_photo_key`, `pod_gps_latitude/longitude`, `pod_notes`
- [ ] `dispatch_documents` — generated reads/PDFs: pick list, loading sheet, delivery challan, POD (P1: printable). MVP: computed endpoints (`GET /dispatches/:id/pick-list`, `/loading-sheet`)

### 12.2 Lifecycle (state machine, no invalid jumps)
- [ ] `allocate` orders to a dispatch (from confirmed orders, same route/area) → status `allocated`
- [ ] `assign` vehicle + driver + planned departure
- [ ] `pick`/`pack` — warehouse picks per pick-list; stock moves warehouse → vehicle location (inventory txns, same txn as Phase 5)
- [ ] `depart` → `in_transit`; per stop: `deliver` (full/partial with actual quantities → drives invoice finalization), `fail` (reason)
- [ ] `complete` → goods received (POD captured) → **invoice finalization** links dispatch stop actuals to the Phase 6 invoice (partial = partial invoice)
- [ ] returns: over/short/damaged at delivery → `sales_returns` credit note flow (reuses Phase 6) + stock back in (Phase 5 txn)

### 12.3 API + permissions
- [ ] `vehicles` CRUD → `dispatch.vehicle.{create,read,update,delete}`
- [ ] `dispatches` create/read/update + lifecycle transitions → `dispatch.dispatch.{create,read,update,complete}` (already in catalog)
- [ ] `stops` deliver/fail → `dispatch.dispatch.update`
- [ ] Driver role: `dispatch.dispatch.read/update` only (existing); warehouse_manager: full
- [ ] Seed: bump version to add `dispatch.vehicle.*` + module row for `dispatch` already present (line ~110)

**Acceptance:** allocated orders → one run with pick list + loading sheet; stock moves with the dispatch txn; per-stop partial/full/fail with POD; invoice finalizes from delivered quantities; driver sees only their dispatch; no invalid status jumps.

## 13. Phase 7 — Purchase & AP

> **Design (decisions 40–43):** no PO in MVP — **direct GRN**; a bill may be entered directly (stock-in on the bill) or against a posted GRN (journal-only). Single-move invariant: stock enters exactly once per goods line (GRN **or** direct bill, never both). GRN never posts a journal; bills/returns stamp `purchase_bill`/`purchase_return` on `journal_entries.source_*` for retry idempotency. Purchase VAT is **input** (DR VAT Receivable 1105). **Perpetual moving-average COGS (decision 42):** value enters on the bill (DR Inventory 1104) and reweights `inventory_balances.avg_cost`; COGS exits on the sales invoice (DR COGS 5101 / CR Inventory 1104 at `avg_cost` incl. free units); Purchases 5102 is not posted in MVP. **TDS (decision 43):** per-line, VAT-exclusive base, recognized at bill time — CR TDS Payable 2103, AP = total − TDS; never touches inventory value. Numbers `GRN-`/`BILL-`/`DN-` reserved at POST via `document_sequences` (FY+branch scoped). NPR-only — no `exchange_rate`/`is_import`. Build order mirrors sales: GRN first (inventory + locations + doc sequences only), then Bill (journal machinery), then Return.

- [x] `inventory_balances.avg_cost` + sales-invoice COGS (decision 42) — new decimal column (migration, default 0); sales-invoice POST snapshots the locked `avg_cost` per line (`InventoryService.averageCostForOut`) **before** the journal, posts COGS **DR COGS 5101 / CR Inventory 1104** at `avg_cost` × `base_quantity` (incl. free units; skipped at 0), the stock-out txn's `unit_cost` now comes from `avg_cost` (not `item.standardCost`), and each line gets a `cogs_unit_cost` snapshot for later returns. **Still pending:** transfer-in carrying the source avg
- [x] TDS plumbing (decision 43) — `TDS_PAYABLE` added to `SYSTEM_PURPOSE` + 2103 marked in `default-coa`; provisioning seeds per-org TDS codes (1.5% services, 15% professional, 5% rent, 10% interest) with `account_id` → 2103; migration `TdsPayable1786950000000` backfills 2103 as a system account + provisions the TDS codes + adds the missing 5%/10% templates for existing orgs; sales invoice **rejects** `TDS_WITHHOLDING` lines (`SALES_INVOICE_TDS_WITHHOLDING`)
- [x] `purchase_receipts`(+lines) — **GRN, stock-in only, no journal** — new `purchase_receipt` inventory txn type (IN, base-uom conversion, requires `inventoryLocationId`, line `unit_cost` from the challan as bill seed); header carries supplier `party_id` (`is_supplier`), `vendor_challan_number`, BS/AD `receipt_date`; per-line `quantity`/`base_quantity`/`unit_cost` + full IRD-style totals (taxable/non-taxable/subtotal/discount/tax/total) + `inventory_transaction_id`; status `DRAFT → POSTED` / `CANCELLED` from DRAFT only; `GRN-` number reserved at POST; `purchase_receipts_per_month` quota consumed
- [x] `purchase_bills`(+lines) — supplier bill/vendor invoice — lines reference `source_purchase_receipt_line_id` (journal-only) **or** are direct (stock-in on the bill via a `purchase_bill` txn in the same atomic POST); per-line VAT tax code **and** per-line TDS (`tds_tax_code_id`/`tds_rate`/`tds_amount`, decision 43); journal DR Inventory 1104 (Σ taxable) + DR VAT Receivable 1105 (Σ VAT) + CR AP 2101 (total − TDS) + CR TDS Payable 2103 (Σ TDS) (+ CR Discounts Received 5104 when > 0) and **reweights `avg_cost`**; stores `vendor_bill_no`; `BILL-` number reserved at POST; status `DRAFT → POSTED` / `CANCELLED` from DRAFT only (paid-state derives from `supplier_payments`, not header status); sourced lines bill once, in full (`billed_quantity` guard), same supplier + same location; `purchase_bills_per_month` quota consumed
- [x] `purchase_returns`(+lines) — debit note — line sources: `source_purchase_bill_line_id` (reverse bill journal + stock-out `purchase_return` txn) **or** `source_purchase_receipt_line_id` never-billed (stock-out only, decision 41); journal DR AP 2101 (net) + DR TDS Payable 2103 + CR Inventory 1104 + CR VAT Receivable 1105, using the source line's snapshotted `tds_*`/tax values; **partial returns** accumulate `returned_quantity` on the source line (guarded `returned ≤ quantity`); a **never-billed GRN return moves quantity out at value 0** (pool value stays, `avg_cost` rises); the bill module now bills the **remaining** quantity (`base − billed − returned`) — sourced bill lines can no longer re-bill returned goods; `DN-` number reserved at POST (draft numberless, `CANCELLED` from DRAFT only, `POSTED` immutable); stock-out-only returns post no journal; permissions `purchase.return.{create,read,update,post,void}` (accountant/manager, seed v22)
- [ ] `supplier_payments`(+lines + `supplier_payment_bill_allocations`) — partial payments
- [x] `expenses`/`expense_lines` — expense entry (COA expense account per line, optional party, VAT tax code + per-line TDS reusing decision 43, CASH/CREDIT modes) — migration `1787500000000-Expense.ts`; per-line `expense_account_id` (RESTRICT) + per-line VAT code + optional TDS code; CASH posts DR expense account(s) + DR VAT Receivable 1105 / CR payment account (active, non-group ASSET); CREDIT posts CR AP 2101 + party net of TDS instead; journal always balanced (DR = subtotal + VAT, CR = total − TDS + TDS); `EXP-` reserved at POST (FY+branch doc sequences), drafts numberless/editable/`CANCELLED`-only-from-draft, `POSTED` immutable; `purchase.expense.{create,read,update,post,void}` permissions (seed v24, accountant/manager); 22 new tests, 605 total

**Acceptance:** GRN increases stock without posting; a bill against a GRN posts a balanced Inventory/AP/VAT journal and moves no stock; a direct bill posts stock-in + journal atomically; sales invoice posts COGS at moving-average cost incl. free units; TDS withholds per line at bill time (AP net, 2103 credited) and reverses exactly on return; over-billing and double stock-in are rejected; returns reverse correctly whether billed or not; partial supplier payments allocate.

## 14. Phase 8 — MVP Reports

- [ ] Sales report (by item / by party / by salesman / by branch, AD+BS date filters)
- [ ] Stock report (on-hand + movement), AR aging, supplier/payable summary
- [ ] Trial balance + P&L (from journal lines), fiscal-year scoped
- [ ] Dashboard endpoints for subscription usage vs limits

## 15. Post-MVP (P1) — tracked, not in current scope

- [ ] `sales_quotations`(+lines)
- [ ] `inventory_batches`(+balances) — expiry tracking (gate behind `batch_tracking` feature flag)
- [ ] `variant_attributes` + variant pricing
- [ ] `exchange_rates` (multi-currency)
- [ ] `attachments`, `transaction_tags`, `journal_entry_tags`
- [ ] `cheques`, `landed_cost_*`
- [ ] Offline-friendly field ops: sync layer for DRIVER/WAREHOUSE_MANAGER mobile flows
- [ ] Reporting dashboards + Nepali calendar UX in frontend
- [ ] Balance sheet report
- [ ] Sales target **achievement** (actual vs target %) — target configuration is done (decision 35, §9.4); computing achievement needs invoice/order lines attributed to salesperson → item category/brand, i.e. Phase 6 data

## 16. DMS Phase C — HR: Leave & Travel

> **Design (decisions 28–30):** HR leave + travel is self-contained ops tooling that reuses org-scoping, RBAC, audit and the Nepali date engine. It runs **off the critical FMCG path** (inventory → sales → dispatch) so it can be built in parallel without blocking §10–14. Travel expense claims eventually post to the accounting engine (§7) via expense accounts — that coupling is deliberately last.
>
> **Decisions locked:**
> 28. **Approval hierarchy = `users.manager_id`** (self-FK, SET NULL). A "manager" is the requester's `manager_id`, verified in the service; the `manager` base role provides the permission grant. No org-chart table in MVP.
> 29. **Leave model:** annual grant per BS calendar year (`leave_balances` keyed by `bs_year`, not accounting fiscal year) — no monthly accrual, no holiday calendar in MVP. Leave requests are BS date ranges; duration = inclusive `daysBetweenBs`. Leave approval consumes balance; reject/cancel doesn't.
> 30. **Expense → accounting is Phase C3:** approved expense claims post an expense journal (debit per-category expense account, credit employee AP / petty cash) via the Phase 3 `document_sequences` + posting machinery. v1 stores receipt *keys* only (binary upload stays P1, decision 26).

### 16.1 Shared infra (Phase C1)
- [x] `users.manager_id` (nullable self-FK)
- [x] `approval_events` — generic org-scoped (entity_type, entity_id, actor_id, action, note); used by leave now, travel later
- [x] `NepaliDateConverter.daysBetweenBs(from, to)` — inclusive BS range day count
- [x] `hr` module + permissions: `hr.leave.{create,read,update,delete,approve}`, `hr.travel.*`, `hr.expense.*`; new `manager` base role (seed v12); salesman gets self-service `hr.leave.*`/`hr.travel.*`/`hr.expense.*`

### 16.2 Leave (Phase C1)
- [x] `leave_types` — org-scoped master: `code` (unique per org), `name`, `is_paid`, `days_per_year`, `carryover_limit_days`, `max_consecutive_days`, `requires_balance`, `is_active`
- [x] `leave_balances` — (org, user, leave_type, `bs_year`); `entitled_days` + `carryover_days` − `used_days`; unique per (org, user, type, year)
- [x] `leave_requests` — (org, user, type, BS from/to, `days`, status `pending → approved/rejected/cancelled`, reason, reviewer_note, approved_by, approved_at); overlap + balance enforced in service; index (org, user, status)
- [x] Apply: valid active type, balance sufficient (if `requires_balance`), no overlap with existing pending/approved; submit → `PENDING` + `approval_event`
- [x] Approve/reject: actor must be requester's `manager_id` (permission `hr.leave.approve`); approve consumes balance; every transition audited
- [x] Cancel: requester or manager, `PENDING` only
- [x] Scoping: users see own leaves/balance; managers see their reportees; admin all

### 16.3 Travel (Phase C2 — next)
- [x] `travel_requests` — (org, user, purpose, from/to, BS dates, transport_mode, estimated_cost, status + approval)
- [x] `travel_expense_claims` — (org, user, optional `travel_request_id`, claim period BS, total, status `pending → approved/rejected → paid`)
- [x] `travel_expense_items` — line items (BS date, category `HOTEL|FOOD|FUEL|TRANSPORT|TOLL|MISC`, description, amount, approved_amount, receipt_key)
- [x] Approval: manager; claims additionally reviewed by `finance_manager`/`accountant` (`hr.expense.approve` → `hr.expense.pay`)

### 16.4 Accounting tie-in (Phase C3 — after C2)
- [ ] Approved claim posts expense journal (per-category expense accounts from COA, credit employee AP) in one transaction
- [ ] `paid` transition marks reimbursement; expense report endpoints (by user / period / category)

### 16.5 Attendance (Phase C2)
- [x] `attendances` — (org, user, `bs_date`, check-in at/remarks/GPS, optional check-out at/remarks/GPS, `status OPEN|CLOSED`, `source DEVICE|MANUAL`, `duration_minutes` derived on check-out)
- [x] Self-service check-in/out (`hr.attendance.create/update`); one OPEN record per user (partial unique index `uq_attendances_open_per_user`); check-out must be after check-in
- [x] Manager corrections: manual entry + adjust (`hr.attendance.adjust`) — service verifies the employee is a reportee via `users.manager_id`; owner may adjust their own record
- [x] Scoping: employees see own records/reports; managers see reportees; `hr.attendance.adjust` guards the org-wide list
- [x] Reports: daily (BS date) + monthly (BS year/month — present days, total/avg minutes, absences vs month length)
- [x] RBAC: salesman gets `create/read/update` (no `adjust`), manager/admin `hr.*`; every action audited

**Acceptance:** employee checks in/out with optional GPS; a second check-in while open is rejected (409); checkout is optional and never before check-in; manager can record/adjust a reportee's day; daily and monthly BS reports are correct; employee cannot read org-wide attendance.

**Acceptance:** salesman applies for leave and sees balance before submitting; manager approves/rejects with notes; balance can never go negative; no overlapping approved leaves; every transition audited; manager sees only their team.

## 17. Nepal-Specific Requirements Mapping

| Requirement | Where it lands |
|---|---|
| Dual AD/BS dates | `nepali-date` module + accounting date columns |
| Nepali fiscal year | `fiscal_years` (Shrawan start), FY close |
| NPR + VAT/TDS | `currencies` seed, `tax_types/codes/templates` |
| Gov-compliant invoice numbering | `document_sequences` (FY + branch unique) |
| Granular RBAC (not hardcoded roles) | `permissions` + `role_permission_mappings` |
| Full auditability | `audit_logs` + `AuditService` |
| Offline-friendly | future sync layer |

## 18. Risk Register

| Risk | Mitigation |
|---|---|
| Knex → TypeORM translation drift | Ship each migration as entities + generated migration reviewed side-by-side with reference |
| Partial unique indexes / CHECKs | TypeORM `@Index({where})`, `@Check`; verify via e2e constraint tests |
| Seed data volume (COA, permissions, plans) | Idempotent versioned seeders; one source of truth per domain |
| RBAC granularity debate | Permission codes defined once in Phase 0 seed, review before Phase 2 |
| Migration 1 dual role (tenant + accounting) | Foundation-first schema baseline; feature delivery stays phased |
| Price-lock drift (in-place price edits change existing customers) | Snapshot `amount`/`currency` on `subscriptions`; price matrices append-only |
| Double-charging from gateway webhook replays | Unique `gateway_transaction_id`; idempotent callback handling |
| Usage-counter drift / race on limits | Seat = live `COUNT` in txn (no storage); periodic = single atomic `UPDATE ... RETURNING id`; over-limit aborts, never soft-increments |
| Period-rollover counter reset timing | Reset inline on consume (`last_reset_at < period_start` branch); no cron dependency |
| New limit dimensions needed later | Limits live in `plans.limits` jsonb + one code enum; no schema change |
| Module-gating assumptions leak back in | `modules` is a catalog only; no `plan_module_mappings`; guards reference `PlanLimitService` |
| FMCG scope creep from reference schema | §3.1 P0/P1/Drop is the contract; any new table must be tagged P0 or moved to P1 |
| Fiscal-year boundary ambiguity (Baisakh vs Shrawan) | **Resolved: statutory Shrawan 1 basis** (decision 19) — §7/§17 contradiction closed, `buildFiscalYearPlan` is the single source of truth, `FixFiscalYearShrawanBasis` data-fix applied; provisioning picks the current statutory FY (month-aware) |
| Double-posting from retried document creation | Partial unique `uq_journal_entries_source (organization_id, source_type, source_id)` (decision 20); document services must stamp `source_type`/`source_id` when posting |
| Cross-module txn coordination (invoice → stock → journal in one txn) | Phase 6/7 post inside one `EntityManager` transaction — `provisionAccounting`/`AuditService` already accept an injected manager; add DB integration tests for the orchestrated flows |
| Posting-engine correctness until Phase 8 reports | Minimal Phase 3 trial balance (decision 21) returns a `balanced` flag so the engine is validated end-to-end now, not months later |
| DMS scope creep (live GPS, vehicle maintenance, fuel) | Spec explicitly defers these (§12 note); P1 list in §15 is the boundary — no live-tracking tables in MVP |
| Outlet/route data quality (dup outlets, bad GPS) | Unique names per org + validation; haversine off-route tolerance configurable; dedupe check on outlet create |
| Dispatch status drift (invalid jumps, lost deliveries) | State machine per §12.2 with server-enforced transitions; every transition audited |
| Photo/POD uploads blocking field ops offline | Store `photo_key` reference only; binary upload is async-capable (decision 26); field app queues and syncs later |

## 19. Progress Tracker

**Legend:** `[x]` done & verified · `[~]` in progress · `[ ]` pending

### Done
- [x] `baseUrl` removed from `tsconfig.json` (deprecated); verified no imports relied on it; build/test still green- [x] `Nepali_Date_converter` ported to typed `src/nepali-date/` (`adToBs`, `bsToAd`, `getDaysInBsMonth`, names)
- [x] Epoch algorithm validated: 100% round-trip BS 2000–2140 / AD 1943–2083; anchors checked (2080-01-01, 2080-11-01, 2078-01-01)
- [x] `NepaliDateModule` registered in `app.module.ts`
- [x] 39 unit tests green; `npm run build` passes; `npm run lint` passes (pre-existing `main.ts` floating-promise only)
- [x] Live smoke-tested: `ad-to-bs`, `bs-to-ad`, `bs-month`, invalid-date → 400
- [x] Read all 8 reference migrations; extracted table inventory
- [x] This plan written (decision log, phases, tracker)
- [x] **Phase 0 complete** — env config + validation, TypeORM wiring + CLI data-source + migrations dir, global ValidationPipe, exception filter, CLS request-ID + response envelope, Swagger at `/api/v1/docs`, `src/common` building blocks (BaseEntity, pagination, decorators), versioned idempotent seed runner + permission-code catalog, unit (51) + e2e (8) green, `npm run lint`/`build`/`test` pass, backend README + `.env.example`. Boot smoke-tested; only DB connection is external.

### In Progress
- [~] Phase 3 — Accounting engine (COA default for new orgs, fiscal years, posting engine) — implementation + DB verification done; reports foundation deferred to Phase 8; phase-3 review follow-ups applied (Shrawan FY basis + data-fix migration, journal source uniqueness index, minimal trial balance)
- [x] **Phase 4 complete** — Trading masters per §8 — implemented + verified live (migration `1786090000000-TradingMasters.ts` applied; seeds v10 `trading-permissions-backfill` applied; smoke-tested UOM/brand/category/item/conversion CRUD, org-wide + per-item conversions, dup-code/self-uom/zero-factor rejection, warehouse_manager `trading.*` (20 perms) allowed, driver 403, seat-limit 403 at limit, soft-delete, audit rows; 213 tests green, lint/build clean). Also fixed pre-existing `IamModule` boot bug (`AuditService` duplicate provider without repo scope)
- [x] **Phase C1 + C2 complete** — HR per §16: leave (types, annual BS-year balances, requests, manager approval via `users.manager_id`), travel (requests, expense claims + line items, manager approve → accountant pay), and attendance (check-in/out with optional GPS, single-open-record rule, manager manual entry/adjust, BS daily + monthly reports) — migrations `1786100000000-HrLeave.ts` + `1786200000000-HrTravel.ts` + `1786300000000-HrAttendance.ts` applied; seeds v12 `hr-permissions-backfill`, v13 `travel-permissions-backfill`, v14/15 `attendance-permissions-backfill` applied (hr module, `manager` role, travel/expense/attendance codes; salesman excluded from `hr.attendance.adjust`); `daysBetweenBs` in `nepali-date`; approval_events CHECK extended with `PAID`; 377 tests green, lint/build clean (decisions 28–34)
- [x] **Sales targets (decision 35)** — `sales_targets` (org, user, BS month, `target_type PERSONAL|CATEGORY|BRAND`, optional category/brand refs, amount, is_active) — migration `1786400000000-SalesTarget.ts` + seed v16 `sales-target-permissions-backfill` applied; RBAC `sales.target.{create,read,update,delete}` (salesman read-only, manager/admin full); team scoping via `manager_id`; monthly BS report grouping personal + categories + brands; 391 tests green (31 suites), lint/build clean; smoke-verified CRUD, duplicate 409, 403 on salesman create, report output
- [x] **Inventory (decision 36)** — `inventory_locations`/`inventory_transactions`(+lines)/`inventory_balances` — migration `1786500000000-Inventory.ts` + seed v17 `inventory-permissions-backfill` applied (`inventory.location.{create,read,update,delete}`, `inventory.transaction.{create,adjust,read}`, `inventory.balance.read`; manager read-only, warehouse_manager full via `inventory.*` glob, salesman/driver excluded); opening stock (once per item/location), stock adjustment (IN/OUT with negative guard + `allow_negative_stock` escape), stock transfer (atomic ±source/dest), base-uom conversion (org-wide then per-item, `NULLS LAST`), low-stock report incl. unstocked reorder items (parenthesized OR guard fixes SQL-precedence leak of reorder-0 rows); 417 tests green (33 suites), lint/build clean; smoke-verified opening/adjust/transfer/negative-guard/409-insufficient/403-salesman; smoke data cleaned
- [x] **Sales orders (decision 37)** — `sales_orders`/`sales_order_lines` (quantity-only capture) — migration `1786600000000-SalesOrder.ts` + seed v18 `sales-order-permissions-backfill` applied (`sales.order.{create,read,update,confirm,cancel,complete}`; salesman all-but-complete, manager/admin via `sales.*`); capture-only: no journal/stock move, warn-only stock check at confirm (free units count against on-hand); per-line `free_quantity` (shipped, never billed) + `discount_percent`, header fixed `discount_amount`, total floor 0, server-derived; UOM conversion reuses inventory rule; `customer_remarks` free-text on header (decision 38); `document_sequences` numbering; flow `DRAFT→CONFIRMED→COMPLETED`/`CANCELED`, no edits after confirm (409 `SALES_ORDER_INVALID_TRANSITION`); salesman `mine` / manager `team` (via `manager_id`) / admin `all`; `complete` manager/admin only; audit row per mutation; read/update/view go through fresh-manager `buildOrderView` (avoids TypeORM identity-map stale lines), party create-in-txn fix via `loadPartyDetails`; 439 tests green (34 suites), lint/build clean; smoke-verified create/confirm/complete/cancel, pricing 10+2 free→950, stock warning `[]` vs `onHand 0/ordered 7`, salesman complete 403, update-recompute 680, list mine; customerRemarks round-trip create/update; smoke data cleaned
- [x] **Sales invoices (decision 39)** — `sales_invoices`/`sales_invoice_lines` (per-order partial billing, full IRD/CBMS field model) — migration `1786700000000-SalesInvoice.ts` + seed v19 `sales-invoice-permissions-backfill` added (`sales.invoice.{create,read,update,post,void}`; salesman all via `sales.invoice.*`); capture from one CONFIRMED/COMPLETED order per invoice, per-line `quantity`/`free_quantity` guarded by order-line `invoiced_quantity` (locked `FOR UPDATE` at prepare + re-validated at POST); number `INV-` reserved at POST, drafts numberless/editable/`CANCELLED`-only-from-draft, `POSTED` immutable; buyer name/address/PAN/VAT + per-line `ird_category`/`tax_rate` snapshots; pro-rata header discount (`order.discount_amount` × invoiced subtotal ÷ order line sum, capped at invoiced net); free goods default to full order-line free qty only when billing the entire remaining; POST = one atomic txn → AR/VAT journal (DR AR 1103 + party, CR Sales 4101, DR Discounts 4102 when > 0, CR VAT 2102; branch fallback invoice→order→first active) + stock-out (`sales_invoice` txn from required `inventoryLocationId`, `base_quantity` incl. free units, `unit_cost` = item standard cost) + `invoiced_quantity` bump + `invoices_per_month` quota; pluggable CBMS push after commit (Noop default `NOT_REQUIRED`, `IrdCbmsInvoiceClient` stub behind `CBMS_ENABLED=true`, failure `FAILED`, never blocks); access owner/admin/salesperson's-manager, `mine`/`team`/`all`; audit per mutation; journal/inventory gained manager-scoped entry points (`createDraftIn`/`postIn`/`getIn`, `issueForSalesInvoice`) + PG `date`-string fix in journal `postIn`; 456 tests green (35 suites), lint/build clean; `FOR UPDATE` limited to `line` table (PG forbids it on outer-join side); smoke data setup deferred — live smoke pending
- [x] **Sales returns (decision 44)** — `sales_returns`/`sales_return_lines` credit-note flow — migration `1787300000000-SalesReturn.ts` + `sales.return.{create,read,update,post,void}` permissions (`sales-return-receipt-permissions.seed.ts`); a line sources a posted `sales_invoice_line` and reverses its price/VAT/`cogs_unit_cost` snapshots at full price; `returned_quantity` accumulator guards partial returns (`remaining ≤ 0` → `SALES_RETURN_NO_REMAINING`, over-quantity → `SALES_RETURN_QUANTITY_EXCEEDED`); drafts numberless/`CANCELLED`-only-from-draft, `POSTED` immutable; `CN-` reserved at POST (FY+branch doc sequences); POST = one atomic txn → reverse journal (CR AR 1103 + party / DR Sales 4101 / DR VAT Payable 2102 / DR Inventory 1104 / CR COGS 5101) + stock re-entry (`sales_return` IN txn at the invoiced avg cost from the required `inventoryLocationId`) + source-line stamp + invoice `balance_amount` decrement, source lines + invoices locked `FOR UPDATE`; `sales_invoice_lines.returned_quantity` column; 14 new tests, 569 total
- [x] **Customer receipts (decision 45)** — `customer_receipts`/`customer_receipt_allocations` money-in — migration `1787400000000-CustomerReceipt.ts` + `sales.receipt.{create,read,update,post,void}` permissions (same seed); allocations target one or more posted invoices of the same customer, `received_amount` = server-derived Σ allocations (no advances in MVP), zero/empty allocations rejected; drafts numberless/`CANCELLED`-only-from-draft, `POSTED` immutable; `RCV-` reserved at POST; POST = one atomic txn → DR receipt account (active, non-group ASSET) / CR AR 1103 (party) journal + per-invoice `paid_amount`/`balance_amount` stamps, invoices re-validated FOR UPDATE (posted, same customer, allocated ≤ live balance → `SALES_RECEIPT_ALLOCATION_EXCEEDS_BALANCE`); mirrors `supplier_payments` on money-in; 13 new tests, 583 total
- [x] **Expenses (decision 43 per-line TDS reuse)** — `expenses`/`expense_lines` — migration `1787500000000-Expense.ts` + `purchase.expense.{create,read,update,post,void}` permissions (seed v24, accountant/manager); per-line `expense_account_id` (RESTRICT) + per-line VAT tax code + optional per-line TDS code; CASH/CREDIT modes; journal DR expense account(s) (gross − discount) + DR VAT Receivable 1105 / CR payment account (CASH, active non-group ASSET) or CR AP 2101 + party (CREDIT) net of TDS + CR TDS Payable 2103; `EXP-` reserved at POST (FY+branch), DRAFT→POSTED→CANCELLED, POSTED immutable, void from DRAFT only; 22 new tests, 605 total; lint/build clean

### Next up
- [x] **Phase 1 complete** (committed `3ffc3ac`, pushed to `main`): tenant + subscription per §5 — migration `1785913601535-TenantAndSubscription.ts` applied; seeds v1–3 (modules, billing periods, plans) applied; `SubscriptionService`/`PlanLimitService`/`@PlanLimit` interceptor; controllers (plans public, subscription, usage snapshot, history, payments/webhook); 76 tests green, lint/build clean; live smoke-tested trial + seat/periodic/feature limits
- [x] **Phase 2 complete** (committed + pushed): IAM + RBAC per §6 — migration `1786035687494-IamAndAuth.ts` applied; seeds v4–6 (IAM modules, 70 permission codes, base-role backfill) applied; DB-backed refresh sessions with rotation; `JwtAuthGuard` + `PermissionsGuard` + `@RequirePermission`/`@Public`; `AuditService` with dual AD/BS timestamps; one-org-per-user onboarding (owner = ADMIN, temp password → forced change); admin bypass via `SUPERUSER_ROLE_CODE`; `password_hash` excluded from API responses; 76 tests green, lint/build clean; live smoke-tested (see §6 acceptance)
- [~] Phase 3 — Accounting engine (FMCG subset, NPR-only) per §7 — implemented + verified live (migration, seeds, backfill, tax uniqueness migration, 151 tests); reports foundation left for Phase 8
- [x] **Phase 4 complete** — Trading masters per §8 — implemented + verified live (see In Progress above)
- [ ] **DMS Phase A (new §9)** — Field sales: outlets, routes, outlet_routes, route_assignments, outlet_visits from `dms_routes_outlets_reference`; salesman-scoped reads; check-in/out with haversine distance + off-route flag; outlet create auto-provisions customer party. No dependency on inventory/orders — build immediately.
- [ ] **DMS Phase B (new §12)** — Dispatch & delivery: vehicles, dispatches, dispatch_stops, pick/loading-sheet reads; per-stop deliver/partial/fail with POD; invoice finalization from delivered quantities; driver-scoped view.
- [ ] **Phase 5+** — DMS Dispatch, Purchase/AP (`supplier_payments`), Reports per plan order (§12–14)

## 20. Reference Migration Inventory (for translation)

> **Applied simplifications:** single vertical (General Trade) — `verticals`/`vertical_module_mappings` dropped; `price_matrices` loses the vertical dimension; **`plan_module_mappings` dropped** (limits live in `plans.limits`); allocation chains collapsed to direct FKs (2 allocation tables kept); P1 items (`exchange_rates`, `attachments`, tags, `variant_attributes`, batches, `cheques`, `landed_cost_*`) and dropped items (`inventory_serials`) per §3.1.

- **1_core_accounting_setup.js** — modules (catalog), organizations, branches → P0; fiscal_years, fiscal_periods, currencies, payment_terms, payment_methods, accounts, parties, party_addresses, tax_types, tax_codes, tax_templates, journal_entries, journal_lines, document_sequences, transaction_types → P0; exchange_rates, attachments, transaction_tags, journal_entry_tags → P1
- **2_subscription_system_setup.js** — plans (+`limits` jsonb), billing_periods, price_matrices, subscriptions, organization_usages, subscription_transactions, subscription_history → P0; plan_module_mappings → dropped
- **3_user_and_access_control_setup.js** — roles, permissions, role_permission_mappings, users, audit_logs → P0
- **4_trading_masters_setup.js** — item_categories, uoms, brands, items, uom_conversions → P0; variant_attributes → P1
- **5_ar_ap_system_setup.js** — sales orders/invoices/returns (+lines), purchase orders/receipts/bills/returns (+lines), expenses (+lines) → P0; sales_quotations → P1; 7 allocation tables → 2 (invoice + bill payment allocations)
- **6_gt_extensions.js** — goods_received_notes merged into `purchase_receipts`; cheques, landed_cost_* → P1; quotations → P1
- **7_gt_inventory_extension.js** — inventory_locations, inventory_transactions (+lines), inventory_balances → P0; inventory_batches → P1; inventory_serials → dropped
- **8_payment_schema.js** — customer_receipts (+lines + invoice allocations), supplier_payments (+lines + bill allocations) → P0; supplier_payment_expense_allocations → P1 (with expenses)
- **8_payment_schema.js** — customer_receipts, supplier_payments (+lines + allocations), expense allocations

> **DMS-specific (not in the 8 reference migrations):** root file `dms_routes_outlets_reference` → `outlets`, `routes`, `outlet_routes`, `route_assignments`, `outlet_visits` (§9). Dispatch/vehicles (§12) are new — `vehicles`, `dispatches`, `dispatch_stops`, with dispatch numbers via the Phase 3 `document_sequences` engine (decision 25).
