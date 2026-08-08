# NEOS DMS — Frontend Implementation Plan & Progress Tracker

> Living document. Update checkboxes only when work is actually verified (typecheck/lint/build green, dev-server smoke).

## 1. Context

- Product vision: `DMS_REQUIREMENTS_SPEC`
- Backend contract: `DMS_IMPLEMENTATION_PLAN.md` (all trading/sales/inventory/dispatch/purchase/accounting APIs are built and live)
- Frontend: `neos_dms_frontend/` — Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Radix UI (`components/ui/*`), TanStack Query, react-hook-form + zod v4, sonner toasts, Serwist PWA, `radix-ui` `ScrollArea`
- API layer: `lib/api/http.ts` `apiFetch<T>()` — JWT auth + refresh-on-401, response-envelope `unwrap`, pagination meta `{page,limit,total,totalPages}`
- Session: `components/providers/auth-provider.tsx` — `useAuth()` exposes `user`, `permissions`, `can(permission)`
- Module gating: `lib/modules/registry.ts` — org module `trading` ↔ backend permission prefix `trading.*`; route prefix `/trading`
- Built so far: landing site, onboarding wizard, app shell (top bar / sidebar / notifications), dashboard placeholder. Trading module T1–T3 shipped (UOMs, brands, categories); T4/T5 queued.
- Priority (A1): the **accounting core is the frontend base** — sales/purchase/inventory modules post into the ledger. A1–A6 ship before trading T4/T5 resume.

## 2. Decisions Log

| # | Decision | Status | Notes |
|---|----------|--------|-------|
| T1 | Feature order mirrors backend Phase 4 dependency chain | Confirmed | UOMs → Brands → Item categories → Items → UOM conversions. Items depend on uoms/brands/categories; conversions depend on uoms/items. Each phase = one shippable CRUD feature (user-driven, one at a time) |
| T2 | Route layout | Confirmed | `app/(org)/trading/` group; one sub-route per resource — `trading/uoms`, `trading/brands`, `trading/categories`, `trading/items`, `trading/conversions`; `/trading` = module overview **with resource cards as the only navigation** (no sub-nav tabs) |
| T3 | Data layer | Confirmed | One typed client per resource in `lib/api/trading.ts` (brandApi/uomApi/categoryApi/itemApi/conversionApi) built on `apiFetch`; selectors need `taxCodeApi`/`accountApi` (backed by `GET /tax/codes`, `GET /accounts`) |
| T4 | Validation | Confirmed | zod v4 schemas in `lib/validation/trading.ts` mirroring backend class-validator DTOs exactly (required `name`, `shortName`, `baseUomId`; `min(0)` money; `maxDecimalPlaces`; nullable clears) |
| T5 | Server state | Confirmed | TanStack Query; list keys `trading.uoms.list({search,page})` etc.; pessimistic mutations + `invalidateQueries` (server re-derives totals, no optimistic fake) |
| T6 | Permissions in UI | Confirmed | `useAuth().can('trading.<resource>.<action>')` gates buttons; full CRUD = `trading.*` glob for warehouse_manager/manager (see backend seed). Hiding, not hard-blocking — API remains the guard |
| T7 | Soft-delete model | Confirmed | Brands/UOMs/Categories/Items use `isActive` toggle (PATCH), no delete UI (backend DELETE = soft delete; UI keeps it simple: toggle). UOM conversions are the only hard-deleteable resource (DELETE endpoint) |
| T8 | Number formatting | Confirmed | `lib/format.ts` — NPR (2dp) money, conversion factor 6dp, `tnum` for tabular figures; values arrive as strings (decimal) from API → parse for input, format for display |
| T9 | Empty states | Confirmed | Every list gets a tailored empty state with a primary "Create first …" CTA (respects `can`) |
| T10 | Reference selects | Confirmed | Selects (UOM/brand/category/tax/account) load active lists, `value = id`, display `name` (shortName for UOM); item form composes all of them |
| T11 | Conversions UX | Confirmed | `conversionFactor` from → to; org-wide (no itemId) + per-item (itemId); manage per-item conversions on the item detail page AND a global conversions page (itemId filter) |
| T12 | Item detail page | Confirmed | `trading/items/[id]` — read-only view (masters) with summary card, tax/account refs, and its conversion list; edit opens the same form in a sheet |
| T13 | Toast + error codes | Confirmed | sonner `toast.success/error`; surface backend codes (e.g. `ITEM_CODE_ALREADY_USED`) with friendly text |
| A1 | Accounting core is the base | Confirmed | Sales/purchase/inventory post into the ledger; build A1–A6 before resuming T4/T5. Order: COA → Fiscal years → Parties → Journal entries → Trial balance/ledger → Tax + sequences |
| A2 | Route layout | Confirmed | `app/(org)/accounting/` group; `/accounting` = overview with resource cards only (matches T2); sub-routes `accounts`, `fiscal-years`, `parties`, `journal-entries`, `journal-entries/[id]`, `trial-balance`, `ledger/[accountId]`, `tax`, `document-sequences` |
| A3 | Data layer | Confirmed | One typed client per resource in `lib/api/accounting.ts` (accountApi/fiscalYearApi/partyApi/journalApi/trialBalanceApi/taxApi/documentSequenceApi) on `apiFetch`; journal form branch select via `GET /organizations/me/branches` (`tenant.branch.read`) |
| A4 | Validation | Confirmed | zod v4 in `lib/validation/accounting.ts` mirroring backend class-validator DTOs (coaType enum; `parentAccountId` nullable; journal lines `min(0)` 4dp, date `YYYY-MM-DD`; party creditLimit/openingBalance 2dp) |
| A5 | Server state | Confirmed | TanStack Query; keys `accounting.*`; pessimistic mutations + `invalidateQueries` (server re-derives balances, no optimistic fake) |
| A6 | Permissions in UI | Confirmed | `useAuth().can('accounting.<resource>.<action>')`; **cancel journal = `accounting.journal-entry.delete`** (backend maps it); system accounts render locked (no edit); hiding, not hard-blocking |
| A7 | Money + formatting | Confirmed | NPR via `lib/format.ts`; 2dp (parties, trial balance) / 4dp (journal lines); values arrive as decimal strings → parse for input, format for display |
| A8 | Journal UX | Confirmed | Dynamic line editor with live debit/credit total + `balanced` indicator (client-side check, server re-validates `UNBALANCED_JOURNAL`); leaf-account-only account select (backend `GROUP_ACCOUNT_POSTING`); post/cancel only for drafts with confirm dialogs |
| A9 | Provisioning | Confirmed | Empty-org state: "Set up accounting" CTA calls idempotent `POST /accounting/provision` (`accounting.fiscal-year.create`) then refetches; no per-account re-provision UI |
| A10 | Trial balance | Confirmed | Grouped by coaType (indented by level/path), opening/activity/closing debit+credit, totals row, `balanced` banner; per-account ledger drill-down via `GET /journal-entries?accountId=` |

## 3. Target Frontend Structure (trading)

```
neos_dms_frontend/
  app/(org)/trading/
    page.tsx                overview — resource cards (primary navigation)
    uoms/page.tsx           Phase T1
    brands/page.tsx         Phase T2
    categories/page.tsx     Phase T3
    items/page.tsx          Phase T4
    items/[id]/page.tsx     Phase T4 (detail + conversions)
    conversions/page.tsx    Phase T5
  components/trading/
    uom/                    uom-table.tsx, uom-form.tsx (sheet)
    brand/                  brand-table.tsx, brand-form.tsx
    category/               category-table.tsx, category-form.tsx
    item/                   item-table.tsx, item-form.tsx, item-summary.tsx
    conversion/             conversion-table.tsx, conversion-form.tsx
    filters.tsx             shared search + filter bar (debounced)
  lib/api/trading.ts        typed clients + types (mirrors backend controllers)
  lib/validation/trading.ts zod schemas (mirrors backend DTOs)
  lib/query/keys.ts         trading.* keys
  lib/format.ts             (exists) + uom/category helpers
```

Convention: each feature = list page (server-state table) + sheet/dialog form (react-hook-form + zod) + typed API client + query keys. Colocate page-level composition in `app/(org)/trading/*`, reusable UI in `components/trading/*`.

## 3b. Target Frontend Structure (accounting core)

```
neos_dms_frontend/
  app/(org)/accounting/
    page.tsx                 overview — resource cards (primary navigation)
    accounts/page.tsx        Phase A1
    fiscal-years/page.tsx    Phase A2
    fiscal-years/[id]/page.tsx Phase A2 (periods grid)
    parties/page.tsx         Phase A3
    journal-entries/page.tsx Phase A4
    journal-entries/[id]/page.tsx Phase A4 (lines + post/cancel)
    trial-balance/page.tsx   Phase A5
    ledger/[accountId]/page.tsx Phase A5 (per-account register)
    tax/page.tsx             Phase A6 (read-only: types / templates / codes)
    document-sequences/page.tsx Phase A6
  components/accounting/
    account/                account-table.tsx, account-form.tsx, account-tree.tsx
    fiscal-year/            fiscal-year-table.tsx, fiscal-year-form.tsx, periods-table.tsx
    party/                  party-table.tsx, party-form.tsx
    journal/                journal-table.tsx, journal-form.tsx (dynamic lines), journal-detail.tsx, line-editor.tsx
    report/                 trial-balance-table.tsx, ledger-table.tsx
    reference/              tax-reference.tsx, document-sequence-table.tsx
  lib/api/accounting.ts     typed clients + types (mirrors backend controllers)
  lib/validation/accounting.ts zod schemas (mirrors backend DTOs)
  lib/query/keys.ts         accounting.* keys
```

## 4. Phases (implement one at a time, in order)

> Each phase ends with: `tsc --noEmit` + `eslint` + `next build` green, and a dev-server smoke of the list/create/edit/toggle flows.

> **Priority:** Accounting core (A1–A6) ships first — it is the ledger that sales/purchase/inventory post into. Trading T4/T5 resume after A6.

### Phase A1 — Accounting shell + Chart of Accounts (first CRUD, sets the pattern)
- `lib/api/accounting.ts` types + `accountApi` (list/create/update/delete), `lib/validation/accounting.ts` `accountSchema` (`name`, `code`, `coaType` ∈ ASSET/LIABILITY/EQUITY/INCOME/EXPENSE, `parentAccountId` nullable, `isGroup`), `accounting.*` query keys
- `app/(org)/accounting/` module; `/accounting` overview (cards linking to the seven resources)
- COA list page: coaType filter tabs (All + 5 types), debounced search (code+name), tree indentation via `level`/`path`, columns code / name / type / group badge / active badge / updated; actions Edit + Activate/Deactivate; system accounts render read-only (lock icon, no edit)
- COA form sheet: `name`, `code`, `coaType`, `parentAccountId` select (group accounts only), `isGroup` toggle
- Acceptance: type filter + search + pagination; create/edit validates; duplicate code 409 `ACCOUNT_CODE_ALREADY_USED` surfaced; parent-must-be-group rule (`ACCOUNT_PARENT_MUST_BE_GROUP`); system accounts protected (`SYSTEM_ACCOUNT_PROTECTED`); delete only for unused leaf accounts (`ACCOUNT_IN_USE` / `ACCOUNT_HAS_CHILDREN` surfaced)

### Phase A2 — Fiscal years
- `fiscalYearApi` (list, get, create, open, close, periods) + `fiscalYearSchema` (`bsYear` int, `name` optional)
- `accounting/fiscal-years` list: BS year + name, start/end dates, status badge (Active/Closed/Planned), periods count; actions Open (`POST /fiscal-years/:id/open`, deactivates the rest) and Close (`POST /fiscal-years/:id/close`); create sheet
- `accounting/fiscal-years/[id]`: 12-period grid (period name, start/end, locked badge)
- Empty state: no fiscal year → "Set up accounting" CTA calling idempotent `POST /accounting/provision` (gated by `accounting.fiscal-year.create`), then refetch
- Acceptance: duplicate/overlap 409 (`FISCAL_YEAR_ALREADY_EXISTS`/`FISCAL_YEAR_OVERLAP`) surfaced; open deactivates others; close locks periods; provision runs once

### Phase A3 — Parties
- `partyApi` (list w/ `role` filter, create, update, delete) + `partySchema` (name; `isCustomer`/`isSupplier`/`isLead` at least one; `partyKind` BUSINESS/INDIVIDUAL; pan/vat/email/phone/address; `creditLimit` + `openingBalance` 2dp `min(0)`; `paymentTermId`; `addresses[]`)
- `accounting/parties` list: name, role badges (Customer/Supplier/Lead), kind, PAN, phone, active badge; role filter chips (customer/supplier/lead) compose with search
- Party form sheet: identity + role toggles (≥1 required, `PARTY_ROLE_REQUIRED`), contact fields, optional addresses section, opening balance (NPR 2dp)
- Acceptance: role filter composes with search; role-required validation; delete NOT exposed (toggle only, matches T7); `accounting.party.*` gating

### Phase A4 — Journal entries (the transaction engine)
- `journalApi` (list w/ `status` + `from`/`to` filters, get, createDraft, post, cancel) + `journalSchema` (`branchId`, `entryDate` YYYY-MM-DD, `description`, `lines[]` each `accountId` + `partyId?` + `debit?`/`credit?` `min(0)` 4dp)
- `accounting/journal-entries` list: JE number (once posted), date, description, status badge (Draft/Posted/Cancelled), total debit/credit; filters: status tabs + from/to date inputs; row click → detail
- Detail page: lines table (account code+name, party, description, debit, credit) with totals; actions Post (draft only, `accounting.journal-entry.post`) and Cancel (draft only, `accounting.journal-entry.delete`) with confirm dialogs
- Create sheet: branch select (`GET /organizations/me/branches`), date picker, description, dynamic line editor — leaf-account select, optional party select, debit + credit fields, live total + `balanced` indicator
- Acceptance: unbalanced draft blocked client-side + `UNBALANCED_JOURNAL` surfaced; `NO_ACTIVE_FISCAL_YEAR` / `FISCAL_PERIOD_LOCKED` surfaced with friendly text; post assigns number; posted entries read-only; cancel of posted/`JOURNAL_NOT_DRAFT` surfaced; group-account posting blocked (`GROUP_ACCOUNT_POSTING`)

### Phase A5 — Trial balance + ledger (reporting base)
- `trialBalanceApi` (`GET /trial-balance` w/ `fiscalYearId`/`from`/`to`)
- `accounting/trial-balance`: fiscal-year select + from/to date range (defaults to active FY), table grouped by coaType (indented by level/path), columns opening / activity / closing debit+credit, net balance, totals row, `balanced` banner (green check / red warning), NPR 2dp
- `accounting/ledger/[accountId]`: per-account register via `GET /journal-entries?accountId=` — date, JE number, description, debit, credit, running balance
- Acceptance: defaults to active FY; `INVALID_REPORT_RANGE` surfaced; grouped + totaled; `balanced` reflects backend flag

### Phase A6 — Tax reference + document sequences (settings)
- `taxApi` (types/templates/codes, read-only) + `documentSequenceApi` (list/create)
- `accounting/tax`: three read-only sections — system tax types, tax templates, org tax codes (name, IRD category, rate, linked account)
- `accounting/document-sequences`: list of numbering sequences (document type, prefix, next number, status); optional create sheet (`document-sequences` POST)
- Acceptance: read-only gated by `accounting.tax.read`; no mutation UI for tax; sequences list/create only (no update endpoint exposed)

### Phase T1 — Trading shell + UOMs (first CRUD, sets the pattern)
- `lib/api/trading.ts` types + `uomApi` (list/create/update/toggle), `lib/validation/trading.ts` `uomSchema`, `trading.*` query keys
- `app/(org)/trading/` module; `/trading` overview (cards linking to the five resources)
- UOM list page: debounced search + pagination, name / shortName / active badge / actions (Edit, Activate/Deactivate)
- UOM form sheet: `name`, `shortName`; create + edit
- Acceptance: filter/search/paginate; create/edit validates; toggle flips `isActive`; empty state + create CTA; 403 → action hidden

### Phase T2 — Brands
- `brandApi` + `brandSchema` (`name`, `isActive`)
- `trading/brands` list + form sheet + toggle (same pattern as T1)
- Acceptance: duplicate-name 409 surfaced as friendly toast; delete NOT exposed (toggle instead)

### Phase T3 — Item categories
- `categoryApi` + `categorySchema` (`name`, `code`, `parentCategoryId` nullable)
- `trading/categories` list showing parent chain (`Parent name` or `—`), form sheet with category select (excludes self)
- Acceptance: nested parent select; clear-parent supported (nullable); delete NOT exposed

### Phase T4 — Items (main feature, resumes after A6)
- `itemApi` (list/search/category/brand/isActive filters, create, update, detail) + `itemSchema` (all CreateItemDto/UpdateItemDto fields)
- `trading/items` table: name, code/SKU, category, brand, base UOM, MRP/sale price, active badge; filter bar (search + category + brand + active)
- Item form sheet: identity (name, code, SKU, barcode, description, type), classification (category, brand, base UOM), pricing (MRP, sale price, standard cost), tax + HSN (taxCodeId, hsnCode), inventory (valuation method, reorder level, tracking, expiry, negative-stock), accounting (sales/purchase/return account selects), active toggle
- `trading/items/[id]` detail page: summary card + per-item conversions list (links to Phase T5)
- Acceptance: required `baseUomId` enforced; code/SKU duplicate → friendly toast; prices `min(0)` + 2dp; filters compose with search; item detail renders refs by name

### Phase T5 — UOM conversions (resumes after A6)
- `conversionApi` (list w/ `itemId` filter, create, delete) + `conversionSchema` (`itemId?`, `fromUomId`, `toUomId`, `conversionFactor` 6dp)
- `trading/conversions` page: org-wide conversions + per-item (filter by item); create sheet; delete (only hard-delete in trading)
- Acceptance: factor `min 0.000001`; org-wide row appears without item; item-scoped rows group on item detail page too

### Phase T6 — Follow-on (out of trading module, tracked)
- Wire items into Sales order/invoice forms, Inventory opening stock, Dispatch loading (each in its own module phase when built)

## 5. Cross-cutting acceptance (every phase)
- Typecheck + lint + `next build` clean
- Dev-server smoke on real backend (user-run, port 3000/3001); auth as warehouse_manager/manager/admin
- No hard deletes for masters; `isActive` toggle only
- Sonner toasts for every mutation outcome; `ApiError.code` → friendly message
- Keyboard/pager: table pagination + debounced search; loading skeletons; empty states
- Money columns formatted NPR (`lib/format.ts`); journal/party inputs parse decimal strings, 2dp (parties/TB) / 4dp (journal lines)
- Journal draft + post/cancel always server-validated; client balance check is a hint, not a guard
- Provisioned data (system accounts, tax codes, payment terms, first fiscal year) is read-mostly in the UI; mutations only where the backend exposes them

## 6. Progress Tracker

**Legend:** `[x]` done & verified · `[~]` in progress · `[ ]` pending

### Done
- [x] This plan written (frontend context, decisions T1–T13, target structure, phase order)
- [x] Backend trading surface confirmed against live API (controllers, DTOs, permission codes, pagination shape, `GET /tax/codes` + `GET /accounts` for item-form refs)
- [x] **Phase T1 — Trading shell + UOMs** — `lib/api/trading.ts` (shared pagination types + `uomApi`), `lib/validation/trading.ts` `uomSchema`, `trading.*` query keys; `app/(org)/trading/` layout with sub-nav + overview cards; UOM list page (debounced search, pagination, active badge, edit/activate-deactivate actions, empty + loading states, `trading.uom.*` gating) + create/edit form sheet (react-hook-form + zod). `tsc --noEmit` + `eslint` + `next build` clean; `/trading` + `/trading/uoms` return 200; backend `/api/v1/uoms` confirmed live (401 unauthenticated). User smoke pending
- [x] **Phase T2 — Brands** — `brandApi` (list/create/update) + `Brand`/dto types, `brandSchema` (`name`), `trading.brandList` query key; `trading/brands` list page (debounced search, pagination, active badge, edit/activate-deactivate actions, empty + loading states, `trading.brand.*` gating, duplicate-name 409 → backend `BRAND_NAME_ALREADY_USED` message surfaced via `getErrorMessage`) + create/edit form sheet (react-hook-form + zod, name only). No delete UI (toggle only). `tsc --noEmit` + `eslint` + `next build` clean; `/trading/brands` returns 200. User smoke pending
- [x] **Phase T3 — Item categories** — `categoryApi` (list/create/update) + `ItemCategory`/dto types (embedded `parentCategory` from list join), `categorySchema` (`name` required, `code` optional, `parentCategoryId` with `"none"` sentinel), `trading.categoryList` query key; `trading/categories` list page (search matches name+code, pagination, parent-name column with `—` fallback, active badge, edit/activate-deactivate, empty + loading states, `trading.item-category.*` gating) + create/edit sheet with parent-category select (excludes self, clear-parent via None, `code:null`/`parentCategoryId:null` clears on update, 409 duplicate code surfaced). No delete UI (toggle only). `tsc` + `eslint` + `next build` clean; `/trading/categories` returns 200. User smoke pending
- [x] Backend accounting core surface confirmed against live API (controllers, DTOs, permission codes `accounting.*`, error codes, trial-balance shape, branch select via `GET /organizations/me/branches`) — plan section A1–A6 written
- [x] **Phase A1 — Accounting shell + Chart of Accounts** — `lib/api/accounting.ts` (COA_TYPES/JOURNAL_STATUSES/PARTY_KINDS/IRD_CATEGORIES + `accountApi`/`branchApi`), `accountSchema`, `accounting.accountList` key; `/accounting` overview with 7 resource cards; `accounts` list (coaType filter tabs, debounced search, `level` tree indent, group/system badges, edit/activate-deactivate/delete with system-account lock) + create/edit sheet (`name`/`code`/`coaType`/`parentAccountId` group-only/`isGroup`). Zod v4 `z.enum(COA_TYPES, { message })`. `tsc` + `eslint` + `next build` clean
- [x] **Phase A2 — Fiscal years (+ provision CTA)** — `fiscalYearApi`/`provisioningApi`, `fiscalYearSchema` (bsYear 4-digit string + regex — avoided `z.coerce.number` which broke RHF typing), `fiscalYearList`/`fiscalYearDetail` keys; `fiscal-years` list (status badges, Open/Close with confirm, "Set up accounting" provision CTA, `accounting.fiscal-year.*` gating) + `fiscal-years/[id]` (summary cards + 12-period grid with locked badges). `tsc` + `eslint` + `next build` clean
- [x] **Phase A3 — Parties** — `partyApi` (list w/ `role` filter, get, create, update, remove), `partySchema` (role toggles ≥1 via superRefine; money as 2dp strings) + `partyAddressSchema`; `partyList` key; `parties` list (role filter tabs + debounced search + pagination, role badges, edit/activate-deactivate only — no delete UI) + create/edit sheet (role toggles, PAN/VAT/email/phone/address, branch select, creditLimit/openingBalance 2dp, optional addresses via useFieldArray on create only, `paymentTermId` skipped — no backend endpoint). `tsc` + `eslint` + `next build` clean
- [x] **Phase A4 — Journal entries** — `journalApi` (list w/ `status`+`from`/`to`/`accountId`, get, create, post, cancel), `journalSchema` (per-line debit-XOR-credit + balanced via superRefine, 4dp strings), `journalList`/`journalDetail` keys; `journal-entries` list (status tabs + from/to date inputs, JE number once posted, row → detail, inline Post, Cancel w/ confirm, `accounting.journal-entry.{create,post,delete}` gating) + `journal-entries/[id]` detail (lines table w/ account/party/description/dr/cr + totals, Post/Cancel draft-only confirm) + create sheet (`branchId` from `GET /organizations/me/branches`, date, description, dynamic line editor with leaf-account select, optional party, live balance indicator via `useWatch`). `tsc` + `eslint` + `next build` clean
- [x] **Phase A5 — Trial balance + ledger** — `trialBalanceApi` (`GET /trial-balance` w/ `fiscalYearId`/`from`/`to`); `trial-balance` page (fiscal-year select defaulting to active FY + from/to range, grouped by coaType indented by level, opening/activity/closing dr+cr, totals row, `balanced` banner — defaults derived without setState-in-effect); `ledger/[accountId]` (per-account register via `GET /journal-entries?accountId=`, date/number/description/dr/cr/running balance with normal-side sign, chronological, links back to journal detail). `tsc` + `eslint` + `next build` clean
- [x] **Phase A6 — Tax reference + document sequences** — `taxApi` (types/templates/codes read-only) + `documentSequenceApi` (list/create); `tax` page (three read-only sections — system types, templates, org codes with IRD badge/rate/linked account); `document-sequences` list (document type, prefix, next number, branch/FY scope) + create sheet (documentType/prefix/branch/FY/lastNumber, `accounting.document-sequence.create` gating). `tsc` + `eslint` + `next build` clean

### In Progress
- [ ] User smoke of accounting core A1–A6 (dev server)

### Next up
- [ ] Phase T4 — Items (resumes after accounting core smoke)
- [ ] Phase T5 — UOM conversions (resumes after accounting core smoke)
- [ ] Phase T6 — Sales/Inventory wiring (deferred)

## 7. Reference — backend trading surface (authoritative)

| Resource | Endpoints (all under `/api/v1`) | Permissions (backend seed) |
|----------|--------------------------------|----------------------------|
| UOMs | `GET/POST /uoms`, `GET/PATCH /uoms/:id`, `DELETE /uoms/:id` | `trading.uom.*` |
| Brands | `GET/POST /brands`, `GET/PATCH /brands/:id`, `DELETE /brands/:id` | `trading.brand.*` |
| Categories | `GET/POST /item-categories`, `GET/PATCH /item-categories/:id`, `DELETE /item-categories/:id` | `trading.item-category.*` |
| Items | `GET/POST /items`, `GET/PATCH /items/:id`, `DELETE /items/:id` | `trading.item.*` (20 perms) |
| UOM conversions | `GET/POST /uom-conversions`, `GET /uom-conversions/:id`, `DELETE /uom-conversions/:id` | `trading.uom-conversion.*` |
| Tax codes (select) | `GET /tax/codes` | read |
| Accounts (select) | `GET /accounts` | read |

List queries: `page` (default 1), `limit` (default 20, max 100), plus `search` / `categoryId` / `brandId` / `isActive` / `itemId` where listed. Response: envelope `{success,data,meta,requestId}`; items sorted `name ASC`; relations (category/brand/baseUom/taxCode) embedded.

## 7b. Reference — backend accounting core surface (authoritative)

| Resource | Endpoints (all under `/api/v1`) | Permissions (backend seed) |
|----------|--------------------------------|----------------------------|
| Accounts | `GET/POST /accounts`, `GET/PATCH/DELETE /accounts/:id` | `accounting.account.*` |
| Fiscal years | `GET /fiscal-years`, `GET /fiscal-years/active`, `POST /fiscal-years`, `GET /fiscal-years/:id`, `POST /fiscal-years/:id/open`, `POST /fiscal-years/:id/close`, `GET /fiscal-years/:id/periods` | `accounting.fiscal-year.{create,read,update,close}` |
| Journal entries | `GET /journal-entries`, `GET /journal-entries/:id`, `POST /journal-entries` (draft), `POST /journal-entries/:id/post`, `POST /journal-entries/:id/cancel` | `accounting.journal-entry.{create,read,post,delete}` — **cancel is gated by `delete`** |
| Trial balance | `GET /trial-balance?fiscalYearId&from&to` (POSTED only; opening/activity/closing per account, totals, `balanced`) | `accounting.journal-entry.read` |
| Parties | `GET/POST /parties`, `GET/PATCH/DELETE /parties/:id` | `accounting.party.*` |
| Tax | `GET /tax/types`, `GET /tax/templates`, `GET /tax/codes`, `GET /tax/codes/:id` | `accounting.tax.read` (CRUD catalogued, only read exposed) |
| Document sequences | `GET/POST /document-sequences` | `accounting.document-sequence.{create,read}` (update catalogued, not exposed) |
| Provisioning | `POST /accounting/provision` (idempotent: COA, fiscal year + 12 periods, payment terms/methods, default tax codes) | `accounting.fiscal-year.create` |
| Branches (select) | `GET /organizations/me/branches` | `tenant.branch.read` |

List queries: `accounts` — `parentId` / `coaType` / `search`; `journal-entries` — `status` (DRAFT/POSTED/CANCELLED) / `from` / `to` / `accountId`; `parties` — `role` (customer/supplier/lead) / `search`. All paginated (`page`, `limit`). Response: envelope `{success,data,meta,requestId}`.

Key error codes to surface via `getErrorMessage`: `ACCOUNT_CODE_ALREADY_USED`, `ACCOUNT_PARENT_MUST_BE_GROUP`, `ACCOUNT_HAS_CHILDREN`, `ACCOUNT_IN_USE`, `SYSTEM_ACCOUNT_PROTECTED`, `GROUP_ACCOUNT_POSTING`, `FISCAL_YEAR_ALREADY_EXISTS`, `FISCAL_YEAR_OVERLAP`, `FISCAL_YEAR_CLOSED`, `FISCAL_PERIOD_LOCKED`, `NO_ACTIVE_FISCAL_YEAR`, `FISCAL_PERIOD_NOT_FOUND`, `UNBALANCED_JOURNAL`, `INVALID_JOURNAL_LINE`, `JOURNAL_ALREADY_POSTED`, `JOURNAL_NOT_DRAFT`, `PARTY_ROLE_REQUIRED`, `INVALID_REPORT_RANGE`, `TAX_CODE_NOT_FOUND`.
