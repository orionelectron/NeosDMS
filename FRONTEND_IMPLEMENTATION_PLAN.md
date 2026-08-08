# NEOS DMS — Frontend Implementation Plan & Progress Tracker

> Living document. Update checkboxes only when work is actually verified (typecheck/lint/build green, dev-server smoke).

## 1. Context

- Product vision: `DMS_REQUIREMENTS_SPEC`
- Backend contract: `DMS_IMPLEMENTATION_PLAN.md` (all trading/sales/inventory/dispatch/purchase/accounting APIs are built and live)
- Frontend: `neos_dms_frontend/` — Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Radix UI (`components/ui/*`), TanStack Query, react-hook-form + zod v4, sonner toasts, Serwist PWA, `radix-ui` `ScrollArea`
- API layer: `lib/api/http.ts` `apiFetch<T>()` — JWT auth + refresh-on-401, response-envelope `unwrap`, pagination meta `{page,limit,total,totalPages}`
- Session: `components/providers/auth-provider.tsx` — `useAuth()` exposes `user`, `permissions`, `can(permission)`
- Module gating: `lib/modules/registry.ts` — org module `trading` ↔ backend permission prefix `trading.*`; route prefix `/trading`
- Built so far: landing site, onboarding wizard, app shell (top bar / sidebar / notifications), dashboard placeholder. No feature modules yet.

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

## 4. Phases (implement one at a time, in order)

> Each phase ends with: `tsc --noEmit` + `eslint` + `next build` green, and a dev-server smoke of the list/create/edit/toggle flows.

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

### Phase T4 — Items (main feature)
- `itemApi` (list/search/category/brand/isActive filters, create, update, detail) + `itemSchema` (all CreateItemDto/UpdateItemDto fields)
- `trading/items` table: name, code/SKU, category, brand, base UOM, MRP/sale price, active badge; filter bar (search + category + brand + active)
- Item form sheet: identity (name, code, SKU, barcode, description, type), classification (category, brand, base UOM), pricing (MRP, sale price, standard cost), tax + HSN (taxCodeId, hsnCode), inventory (valuation method, reorder level, tracking, expiry, negative-stock), accounting (sales/purchase/return account selects), active toggle
- `trading/items/[id]` detail page: summary card + per-item conversions list (links to Phase T5)
- Acceptance: required `baseUomId` enforced; code/SKU duplicate → friendly toast; prices `min(0)` + 2dp; filters compose with search; item detail renders refs by name

### Phase T5 — UOM conversions
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

## 6. Progress Tracker

**Legend:** `[x]` done & verified · `[~]` in progress · `[ ]` pending

### Done
- [x] This plan written (frontend context, decisions T1–T13, target structure, phase order)
- [x] Backend trading surface confirmed against live API (controllers, DTOs, permission codes, pagination shape, `GET /tax/codes` + `GET /accounts` for item-form refs)
- [x] **Phase T1 — Trading shell + UOMs** — `lib/api/trading.ts` (shared pagination types + `uomApi`), `lib/validation/trading.ts` `uomSchema`, `trading.*` query keys; `app/(org)/trading/` layout with sub-nav + overview cards; UOM list page (debounced search, pagination, active badge, edit/activate-deactivate actions, empty + loading states, `trading.uom.*` gating) + create/edit form sheet (react-hook-form + zod). `tsc --noEmit` + `eslint` + `next build` clean; `/trading` + `/trading/uoms` return 200; backend `/api/v1/uoms` confirmed live (401 unauthenticated). User smoke pending

### In Progress
- (none)

### Next up
- [ ] Phase T2 — Brands
- [ ] Phase T3 — Item categories
- [ ] Phase T4 — Items (+ item detail page)
- [ ] Phase T5 — UOM conversions
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
