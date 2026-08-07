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
| 3 | Feature focus order | **Revised** | Tenant+Subscription → IAM → Accounting engine → Trading → Inventory → Sales/AR → Purchase/AP → Reports (FMCG priority, see §8–12) |
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
| 19 | Fiscal year basis | **Revised: Shrawan 1 (statutory)** | §7 originally said Baisakh 1 (BS calendar year) while §14 said Shrawan — a real contradiction. Resolved to Nepal's statutory IRD fiscal year: FY `2083/84` = 2026-07-17 → 2027-07-16, 12 periods Shrawan→Chaitra of `bsYear` then Baisakh→Ashadh of `bsYear+1`. `buildFiscalYearPlan` + provisioning updated; migration `FixFiscalYearShrawanBasis1786080000000` rebuilds existing orgs' FYs (label year parsed from the FY name, so it is deterministic and preserves FY ids/names) |
| 20 | Journal source idempotency | **Added** | Partial unique index `uq_journal_entries_source (organization_id, source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL` (migration `JournalEntrySourceUniqueness1786081000000`) so a retried invoice/bill creation can never double-post its journal entry; the existing org+source index stays as the plain lookup index |
| 21 | Trial balance in Phase 3 | **Added** | Minimal read-only `GET /trial-balance` (per-account opening/activity/closing + `balanced` flag over POSTED entries) landed now to validate the posting engine and surface journal_lines schema gaps cheaply; pretty GL/P&L reports remain Phase 8 |

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
- Inventory: `inventory_locations`, `inventory_transactions`, `inventory_balances` (quantity only)
- Sales/AR: `sales_orders`(+lines), `sales_invoices`(+lines), `sales_returns`(+lines) credit-note flow, `customer_receipts`(+lines + invoice allocations)
- Purchase/AP: `purchase_orders`(+lines), `purchase_receipts`/GRN(+lines), `purchase_bills`(+lines), `purchase_returns`(+lines), `supplier_payments`(+lines + bill allocations), `expenses`(+lines)
- Accounting engine: `fiscal_years`, `fiscal_periods`, `currencies` (NPR base), `payment_terms`, `payment_methods`, `accounts` (+default COA seed), `parties`, `party_addresses`, `tax_types`, `tax_codes`, `tax_templates`, `journal_entries`, `journal_lines`, `document_sequences`, `transaction_types`
- Core reports: trial balance, P&L, AR aging, stock report

**P1 — quick follow-on (same fiscal cycle, out of MVP):**
- `sales_quotations`(+lines), `inventory_batches`(+balances) for expiry, `variant_attributes`, `exchange_rates`, `attachments`, `transaction_tags`/`journal_entry_tags`, `cheques`, `landed_cost_*`, dedicated GRN merge, offline sync layer, dashboards

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

- [ ] `item_categories`, `uoms`, `brands`, `items` (SKU, base UOM, default price, tax template, reorder level)
- [ ] `uom_conversions` — case ↔ piece conversion (critical for FMCG; `factor` + CHECK factor > 0)
- [ ] Enforce `items` seat limit on item create
- [ ] Endpoints: items CRUD, categories, brands, UOM + conversions

**Acceptance:** an item can be sold/invoiced in cases and stocked in pieces; conversions are unit-safe.

## 9. Phase 5 — Inventory (quantity-based, no batches in MVP)

- [ ] `inventory_locations` (godown / van / shop), `inventory_transactions`(+lines) with `transaction_type` (`purchase_receipt`, `sales_invoice`, `sales_return`, `purchase_return`, `stock_adjustment`), `inventory_balances` (per location × item)
- [ ] Stock moves inside the same DB transaction as the source document (GRN, invoice, return)
- [ ] Balance constraint: selling/deleting below available stock rejected; balance never goes negative
- [ ] `batch_tracking` feature flag gates future P1 batch columns (no schema churn now)

**Acceptance:** every stock in/out is an `inventory_transaction`; balance is derived & consistent; negative stock impossible.

## 10. Phase 6 — Sales & AR

- [ ] `sales_orders`(+lines) — order by SALESMAN, status flow (draft → confirmed → invoiced → completed / canceled)
- [ ] `sales_invoices`(+lines) — creates journal entry (AR ↔ Sales Income + VAT) + stock out + doc sequence number, all in one transaction; `orders_per_month`/`invoices_per_month` limits consumed via `@PlanLimit`
- [ ] `sales_returns`(+lines) — credit note flow, reverses journal + stock
- [ ] `customer_receipts`(+lines + `customer_receipt_invoice_allocations`) — partial payments against invoices; posts to journal
- [ ] FKs replace the reference's order→invoice→return allocation chains (Decision 15)

**Acceptance:** invoicing posts balanced journals, decrements stock, consumes invoice quota atomically; partial payments allocate correctly; invoice number unique per FY.

## 11. Phase 7 — Purchase & AP

- [ ] `purchase_orders`(+lines) — supplier PO, status flow
- [ ] `purchase_receipts`(+lines) — GRN (merge reference `goods_received_notes`); stock in + `purchase_receipts_per_month` limit consumed
- [ ] `purchase_bills`(+lines) — supplier bill, posts to journal (AP ↔ Inventory/Expense + VAT)
- [ ] `purchase_returns`(+lines) — debit note flow
- [ ] `supplier_payments`(+lines + `supplier_payment_bill_allocations`) — partial payments
- [ ] `expenses`/`expense_lines` — simple expense entry (category, party, tax), posts to journal

**Acceptance:** GRN increases stock; bills post balanced journals; partial supplier payments allocate.

## 12. Phase 8 — MVP Reports

- [ ] Sales report (by item / by party / by salesman / by branch, AD+BS date filters)
- [ ] Stock report (on-hand + movement), AR aging, supplier/payable summary
- [ ] Trial balance + P&L (from journal lines), fiscal-year scoped
- [ ] Dashboard endpoints for subscription usage vs limits

## 13. Post-MVP (P1) — tracked, not in current scope

- [ ] `sales_quotations`(+lines)
- [ ] `inventory_batches`(+balances) — expiry tracking (gate behind `batch_tracking` feature flag)
- [ ] `variant_attributes` + variant pricing
- [ ] `exchange_rates` (multi-currency)
- [ ] `attachments`, `transaction_tags`, `journal_entry_tags`
- [ ] `cheques`, `landed_cost_*`
- [ ] Offline-friendly field ops: sync layer for DRIVER/WAREHOUSE_MANAGER mobile flows
- [ ] Reporting dashboards + Nepali calendar UX in frontend
- [ ] Balance sheet report

## 14. Nepal-Specific Requirements Mapping

| Requirement | Where it lands |
|---|---|
| Dual AD/BS dates | `nepali-date` module + accounting date columns |
| Nepali fiscal year | `fiscal_years` (Shrawan start), FY close |
| NPR + VAT/TDS | `currencies` seed, `tax_types/codes/templates` |
| Gov-compliant invoice numbering | `document_sequences` (FY + branch unique) |
| Granular RBAC (not hardcoded roles) | `permissions` + `role_permission_mappings` |
| Full auditability | `audit_logs` + `AuditService` |
| Offline-friendly | future sync layer |

## 15. Risk Register

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
| Fiscal-year boundary ambiguity (Baisakh vs Shrawan) | **Resolved: statutory Shrawan 1 basis** (decision 19) — §7/§14 contradiction closed, `buildFiscalYearPlan` is the single source of truth, `FixFiscalYearShrawanBasis` data-fix applied; provisioning picks the current statutory FY (month-aware) |
| Double-posting from retried document creation | Partial unique `uq_journal_entries_source (organization_id, source_type, source_id)` (decision 20); document services must stamp `source_type`/`source_id` when posting |
| Cross-module txn coordination (invoice → stock → journal in one txn) | Phase 6/7 post inside one `EntityManager` transaction — `provisionAccounting`/`AuditService` already accept an injected manager; add DB integration tests for the orchestrated flows |
| Posting-engine correctness until Phase 8 reports | Minimal Phase 3 trial balance (decision 21) returns a `balanced` flag so the engine is validated end-to-end now, not months later |

## 16. Progress Tracker

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

### Next up
- [x] **Phase 1 complete** (committed `3ffc3ac`, pushed to `main`): tenant + subscription per §5 — migration `1785913601535-TenantAndSubscription.ts` applied; seeds v1–3 (modules, billing periods, plans) applied; `SubscriptionService`/`PlanLimitService`/`@PlanLimit` interceptor; controllers (plans public, subscription, usage snapshot, history, payments/webhook); 76 tests green, lint/build clean; live smoke-tested trial + seat/periodic/feature limits
- [x] **Phase 2 complete** (committed + pushed): IAM + RBAC per §6 — migration `1786035687494-IamAndAuth.ts` applied; seeds v4–6 (IAM modules, 70 permission codes, base-role backfill) applied; DB-backed refresh sessions with rotation; `JwtAuthGuard` + `PermissionsGuard` + `@RequirePermission`/`@Public`; `AuditService` with dual AD/BS timestamps; one-org-per-user onboarding (owner = ADMIN, temp password → forced change); admin bypass via `SUPERUSER_ROLE_CODE`; `password_hash` excluded from API responses; 76 tests green, lint/build clean; live smoke-tested (see §6 acceptance)
- [~] Phase 3 — Accounting engine (FMCG subset, NPR-only) per §7 — implemented + verified live (migration, seeds, backfill, tax uniqueness migration, 151 tests); reports foundation left for Phase 8
- [ ] Phase 4+ — Trading masters, Inventory, Sales/AR, Purchase/AP, Reports per plan order

## 17. Reference Migration Inventory (for translation)

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
