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
| 2 | ORM = TypeORM (0.3.x) + `@nestjs/typeorm` | Confirmed | Decorator entities, supports PG constraints via `@Index({where})`, `@Check`, `jsonb` |
| 3 | Feature focus order | Confirmed | Subscription → IAM/RBAC → Core accounting |
| 4 | `tsconfig` `baseUrl` | **Resolved: removed** | Deprecated; no imports rely on it (all relative paths) |
| 5 | `noImplicitAny` | Current: `false` | Prefer keeping false for now; revisit per-file |
| 6 | Migrations | Never `synchronize: true` in prod; `migration:generate` from entities, review, commit | |
| 7 | API versioning | `/api/v1` prefix | |
| 8 | Auth | JWT (access + refresh), bcrypt, stateless | Built in Phase 2 |
| 9 | Frontend | Out of scope this round | |
| 10 | Verticals | **Single vertical: General Trade** — drop `verticals` & `vertical_module_mappings`; price matrices not vertical-scoped | Simplifies subscription + tenant model |

## 3. Target Backend Structure

```
neos_dms_backend/src/
  main.ts, app.module.ts
  config/            env.validation.ts, configuration.ts (typed via @nestjs/config + class-validator)
  database/          data-source.ts, migrations/, seeders/, base.entity.ts
  common/            decorators/ guards/ interceptors/ filters/ pipes/ dto/ enums/
  modules/
    tenant/          modules, organizations, branches
    subscription/    plans, billing_periods, price_matrices, plan_module_mappings,
                     subscriptions, organization_usages, subscription_transactions, subscription_history
    iam/             users, roles, permissions, role_permission_mappings, audit_logs, auth
    accounting/      fiscal_years, fiscal_periods, currencies, exchange_rates, payment_terms,
                     payment_methods, accounts, parties, party_addresses, tax_types, tax_codes,
                     tax_templates, journal_entries, journal_lines, document_sequences, attachments,
                     transaction_types, transaction_tags, journal_entry_tags
  nepali-date/       existing module (AD/BS conversion, BS month calendar)
```

Convention: each module = `*.module.ts`, `*.controller.ts`, `*.service.ts`, `entities/`, `dto/`, `*.spec.ts`. Colocate entities with features; migrations centralized in `src/database/migrations`.

## 4. Cross-Cutting Foundation (Phase 0)

- [ ] Typed env config with validation (`@nestjs/config` + class-validator), fails fast on missing vars
- [ ] `TypeOrmModule.forRootAsync`, data-source for CLI, `src/database/migrations/`
- [ ] Global `ValidationPipe` (whitelist, transform, forbidNonWhitelisted), DTOs everywhere
- [ ] Global exception filter — structured `{ status, code, message, details, requestId }`
- [ ] Request-ID + response envelope interceptor; structured logging (Pino optional)
- [ ] Swagger/OpenAPI mounted at `/api/v1/docs`
- [ ] `src/common/` building blocks: `BaseEntity` (id, timestamps, audit cols), pagination DTO, `CurrentUser`/`CurrentTenant` decorators
- [ ] Base roles + permission codes seed strategy (seeds versioned, idempotent)
- [ ] Unit + e2e test harness; `npm run lint` / `npm test` green on CI
- [ ] README for backend (run, migrate, seed, test) + commit conventions

## 5. Phase 1 — Tenant & Subscription System

DB ordering note: migrations 2 & 3 reference `organizations`, `modules`, `branches` — these tenant tables come from migration 1, so the **schema baseline is created foundation-first** even though accounting features land in Phase 3.

### 5.1 Tenant scaffolding (from migration 1, simplified)
- [ ] Entities + migration: `modules`, `organizations`, `branches`
- [ ] Drop `verticals` / `vertical_module_mappings` (single vertical: General Trade)
- [ ] Seeded modules: e.g. `inventory`, `sales`, `purchase`, `accounting`, `reports`, `dispatch`

### 5.2 Subscription tables (from migration 2, adapted)
- [ ] Entities + migration: `plans`, `billing_periods`, `price_matrices`, `plan_module_mappings`, `subscriptions`, `organization_usages`, `subscription_transactions`, `subscription_history`
- [ ] Adaptation — drop `price_matrices.vertical_id`; unique price point becomes `(plan_id, billing_period_id)`
- [ ] Adaptation — `plans.code` (unique, stable slug: `basic`/`professional`/`enterprise`) for rename-safe system refs
- [ ] Adaptation — partial unique index on `subscriptions`: at most one `trialing`/`active`/`past_due` per `organization_id`
- [ ] Adaptation — price lock: snapshot `amount`/`currency` onto `subscriptions` (or keep `price_matrices` append-only/versioned)
- [ ] Adaptation — `subscription_transactions.gateway_transaction_id` unique (webhook idempotency for eSewa/Khalti); add `paid_at`
- [ ] Adaptation — CHECK constraints on `subscriptions.status` and `subscription_transactions.status` enum values
- [ ] Adaptation — `subscription_history` gains `changed_by` + `reason` (self-contained state timeline)
- [ ] Adaptation — grace handling: store `grace_period_end` (or compute from `current_period_end`) for past_due→canceled scheduler
- [ ] Seed base plans (single General Trade vertical; price per billing period, no vertical dimension)
- [ ] `SubscriptionService` — status lifecycle: `trial → active → past_due → canceled`
- [ ] `PlanModuleMappingService` — which modules a plan unlocks (drives feature gating)
- [ ] Usage counters (`organization_usages`) for plan limits
- [ ] Endpoints: plan catalog (public), org subscription (create/change/cancel), usage, history, webhook hook point for billing
- [ ] Guard: subscription/plan limits enforced at service layer

**Acceptance:** new org gets trial subscription; plan change restricts module access; usage tracked; org can never hold two active subscriptions; gateway callbacks are idempotent (replay-safe).

## 6. Phase 2 — User & Access Control (IAM + RBAC)

### 6.1 Tables (from migration 3)
- [ ] Entities + migration: `roles`, `permissions`, `role_permission_mappings`, `users`, `audit_logs`
- [ ] Permission codes as granular `Module.Action` (e.g. `accounting.journal-entry.create`), **not** hardcoded roles (spec requirement)
- [ ] Seed base roles from spec: `ADMIN`, `ACCOUNTANT`, `SALESMAN`, `DRIVER`, `WAREHOUSE_MANAGER` + permission mappings
- [ ] Seed `audit_logs` trigger points for every business event (spec requirement)

### 6.2 Auth + RBAC plumbing
- [ ] JWT auth (access + refresh), bcrypt, login/register, org onboarding + invite
- [ ] `JwtAuthGuard` (global) + `PermissionsGuard` + `@RequirePermission(...)` decorator
- [ ] `RolesGuard` only for coarse admin checks; fine-grained via permissions
- [ ] Tenancy: org scoping helper (all queries auto-filtered by `organization_id`)
- [ ] `AuditService` — records actor, action, entity, before/after, ip, occurred_at (BS/AD dual timestamp)
- [ ] Endpoints: users CRUD, roles CRUD, permissions list, role-permission mapping, audit log query (paginated)

**Acceptance:** login issues JWT; role with `sales.*` perms can't hit `accounting.*`; every mutation is audited.

## 7. Phase 3 — Core Accounting

Translates migration 1's accounting tables. Reuses `nepali-date` for dual dates + Nepali fiscal year (Shrawan start) + fiscal year close.

- [ ] `fiscal_years`, `fiscal_periods` — one active FY per org (partial unique index), BS + AD date range
- [ ] `currencies`, `exchange_rates` — global + org-specific, one base currency per org, NPR default seed
- [ ] `payment_terms`, `payment_methods`
- [ ] `accounts` — hierarchical chart of accounts, system-purpose accounts; **default COA seeded per org on creation**
- [ ] `parties`, `party_addresses` — customer/supplier/lead (CHECK at-least-one-role), payment terms
- [ ] `tax_types`, `tax_codes`, `tax_templates` — VAT/TDS, `math_sign IN (1,-1)` CHECK
- [ ] `journal_entries` + `journal_lines` — balanced double-entry; debit/credit mutual-exclusion CHECK; posting in a transaction
- [ ] `document_sequences` — fiscal-year-scoped, branch-safe sequential numbering (gov-compliant invoices) with prefix
- [ ] `transaction_types`, `transaction_tags`, `journal_entry_tags`, `attachments`
- [ ] Core reports foundation: trial balance, general ledger, P&L, balance sheet
- [ ] Fiscal year open/close workflow

**Acceptance:** double-entry posting rejects unbalanced entries; invoice numbers unique per FY; reports tie to journal lines.

## 8. Later Phases (tracked, not in current scope)

- [ ] Trading masters (migration 4): `items`, `item_categories`, `uoms`, `uom_conversions`, `brands`, `variant_attributes`
- [ ] Sales & purchasing / AR-AP (migration 5): quotations, orders, invoices, returns, bills, allocations
- [ ] Inventory extension (migration 7): locations, transactions, batches, serials, balances
- [ ] Payments (migration 8): customer receipts, supplier payments, allocations
- [ ] GT extensions (migration 6): cheques, landed cost, GRN
- [ ] Offline-friendly field ops (spec): sync layer for DRIVER/WAREHOUSE_MANAGER mobile flows
- [ ] Reporting dashboards + Nepali calendar UX in frontend

## 9. Nepal-Specific Requirements Mapping

| Requirement | Where it lands |
|---|---|
| Dual AD/BS dates | `nepali-date` module + accounting date columns |
| Nepali fiscal year | `fiscal_years` (Shrawan start), FY close |
| NPR + VAT/TDS | `currencies` seed, `tax_types/codes/templates` |
| Gov-compliant invoice numbering | `document_sequences` (FY + branch unique) |
| Granular RBAC (not hardcoded roles) | `permissions` + `role_permission_mappings` |
| Full auditability | `audit_logs` + `AuditService` |
| Offline-friendly | future sync layer |

## 10. Risk Register

| Risk | Mitigation |
|---|---|
| Knex → TypeORM translation drift | Ship each migration as entities + generated migration reviewed side-by-side with reference |
| Partial unique indexes / CHECKs | TypeORM `@Index({where})`, `@Check`; verify via e2e constraint tests |
| Seed data volume (COA, permissions, plans) | Idempotent versioned seeders; one source of truth per domain |
| RBAC granularity debate | Permission codes defined once in Phase 0 seed, review before Phase 2 |
| Migration 1 dual role (tenant + accounting) | Foundation-first schema baseline; feature delivery stays phased |
| Price-lock drift (in-place price edits change existing customers) | Snapshot `amount`/`currency` on `subscriptions`; price matrices append-only |
| Double-charging from gateway webhook replays | Unique `gateway_transaction_id`; idempotent callback handling |

## 11. Progress Tracker

**Legend:** `[x]` done & verified · `[~]` in progress · `[ ]` pending

### Done
- [x] `baseUrl` removed from `tsconfig.json` (deprecated); verified no imports relied on it; build/test still green- [x] `Nepali_Date_converter` ported to typed `src/nepali-date/` (`adToBs`, `bsToAd`, `getDaysInBsMonth`, names)
- [x] Epoch algorithm validated: 100% round-trip BS 2000–2140 / AD 1943–2083; anchors checked (2080-01-01, 2080-11-01, 2078-01-01)
- [x] `NepaliDateModule` registered in `app.module.ts`
- [x] 39 unit tests green; `npm run build` passes; `npm run lint` passes (pre-existing `main.ts` floating-promise only)
- [x] Live smoke-tested: `ad-to-bs`, `bs-to-ad`, `bs-month`, invalid-date → 400
- [x] Read all 8 reference migrations; extracted table inventory
- [x] This plan written (decision log, phases, tracker)

### In Progress
- [~] Tsconfig decision: `baseUrl` keep/remove (user)

### Next up
- [ ] Commit Nepali date feature (awaiting user go-ahead)
- [ ] Phase 0 scaffolding per section 4

## 12. Reference Migration Inventory (for translation)

> **Applied simplification:** `verticals` and `vertical_module_mappings` are dropped (single General Trade vertical); `price_matrices` loses the vertical dimension.

- **1_core_accounting_setup.js** — verticals, modules, vertical_module_mappings, organizations, branches, fiscal_years, fiscal_periods, currencies, exchange_rates, payment_terms, payment_methods, accounts, parties, party_addresses, tax_types, tax_codes, tax_templates, transaction_tags, journal_entries, journal_entry_tags, journal_lines, document_sequences, attachments, transaction_types
- **2_subscription_system_setup.js** — plans, billing_periods, price_matrices, plan_module_mappings, subscriptions, organization_usages, subscription_transactions, subscription_history
- **3_user_and_access_control_setup.js** — roles, permissions, role_permission_mappings, users, audit_logs
- **4_trading_masters_setup.js** — item_categories, uoms, brands, variant_attributes, items, uom_conversions
- **5_ar_ap_system_setup.js** — sales quotations/orders/invoices/returns (+lines), purchase orders/receipts/bills/returns (+lines), expenses (+lines), 7 allocation tables
- **6_gt_extensions.js** — cheques, landed_cost_* (vouchers/expenses/item_adjustments), quotations, purchase_orders, goods_received_notes
- **7_gt_inventory_extension.js** — inventory_locations, inventory_transactions (+lines), inventory_batches, inventory_serials, balances
- **8_payment_schema.js** — customer_receipts, supplier_payments (+lines + allocations), expense allocations
