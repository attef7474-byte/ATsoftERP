# Unified Item Master — Phase 1 Discovery / Gap / Data-Classification Report

**Date:** 2026-11-19
**Branch:** `feat/unified-item-master-phase-1`
**Starting baseline:** `08f152ee2efcba2d0aade07665f88ec875cc8be7` (= `origin/main`, ahead/behind `0/0`, clean tree)
**Migrations applied on baseline:** 96 (latest `20261119000000_shared_machine_component_multi_machine`)
**Rule:** discovery completed before any source modification. Production DB queried **read-only** (`sqlcmd -E`, SELECT only).

---

## 1. Required discovery classification

| # | Capability | Classification | Evidence |
|---|---|---|---|
| 1 | Canonical Product authority | `EXISTS — REUSE` | `Product` model (`schema.prisma:1657-1716`); single global catalog row; single create/update API (`POST /products`, `PATCH /products/:id`) via `ProductAggregateService`; single form `product-form.tsx`; single grid `products-workspace.tsx`. |
| 2 | Production Product configuration authority | `EXISTS — REUSE` | `ProductionProductDefinition` + specifications/versions/packagings/eligibilities (`schema.prisma:605-756`); `ProductAggregateService` writes config through the canonical product form via nested optional `production` block; no second product identity. |
| 3 | SparePart authority | `EXISTS — REUSE` | `SparePart` (`schema.prisma:2733-2795`) owns manufacturer/model/partNumber/classification/usageType/nature/importance/criticality/technical fields; canonical page `/admin/maintenance/spare-parts`. |
| 4 | Product ↔ SparePart relationship | `EXISTS — REUSE` (needs enforcement extension) | `SparePart.productId` (nullable) is the only authoritative link (`schema.prisma:2757-2758`, index 2792). No `Product.sparePartId`. Relationship currently **not** type-validated. |
| 5 | Product type/classification fields | `MISSING — ADD` | No `itemType`/business-type field on Product anywhere in `apps/`. Only `ProductCategory` (hierarchical category master, `schema.prisma:1617-1635`) and `ProductUom`. |
| 6 | Existing field already safely representing `itemType` | `MISSING — ADD` | `status` = ACTIVE/INACTIVE; `categoryId` = user-defined category tree; `unit` = UOM; none is a business-type discriminator. Confirmed by full-text search. |
| 7 | Can `ProductCategory` replace `itemType`? | `MISSING — ADD` (dedicated field required) | Category is a hierarchical, user-maintained reference (`parentId`, free `name`, `code`) — it is not bounded, not mutually exclusive, and serves a different purpose (e.g. زيوت/توابل/دقيق under RAW_MATERIAL). Adding a dedicated authoritative field is required. |
| 8 | Excel Product contract | `PARTIAL — EXTEND` | `excel.definitions.ts:49-53`: Code, Name, Description, CategoryCode, UnitCode, UnitLabel, Barcode, MinStock, MaxStock. No `Item Type`. Import/export/template/round-trip reuse `master-data-excel.service.ts`. |
| 9 | F9 product lookup | `PARTIAL — EXTEND` | Web `productAdapter` (`lookup-adapters.ts:109-120`) hits `GET /products`; `F9Lookup` already supports `filters` → query params. Backend `/products` (`products.service.ts:275-307`) has no `itemType` filter; unified `/search/product` (`search.service.ts:417-460`) has no `itemType` filter. |
| 10 | Legacy MachinePart | `LEGACY — PRESERVE READ-ONLY` | `/admin/maintenance/machine-parts` is already read-only (page doc + refresh-only action + legacy banner). No nav entry. Canonical `sparePartId` link added in R4N. |
| 11 | Exact migration required | `MISSING — ADD` | One additive migration: nullable `itemType` on `products`, evidence-based backfill of unambiguous rows, SQL CHECK constraint for the 6-value vocabulary, one index on `itemType` for the new server-side filter. No row/column/identity/movement changes. |
| 12 | Exact UI files affected | `PARTIAL — EXTEND` | See §2. |

No Prisma `enum` exists anywhere in `schema.prisma`; the project convention is bounded `String` vocabularies + SQL `CHECK` constraints (e.g. `20260922010000_cost_r2d_b3_.../migration.sql:27-36`). Phase 1 follows that convention.

---

## 2. Exact UI files affected

**Inventory Items (primary master)**
- `apps/web/src/app/admin/inventory/products/page.tsx`
- `apps/web/src/components/inventory/products/products-workspace.tsx` (title, itemType column, server-side filters)
- `apps/web/src/app/admin/inventory/products/product-form.tsx` (itemType selector + dynamic sections + spare-part section)
- `apps/web/src/app/admin/inventory/products/new/page.tsx`, `[id]/edit/page.tsx` (deep-link redirects — preserve)

**Production Product Setup (not a second master)**
- `apps/web/src/app/admin/production/product-definitions/page.tsx`
- `apps/web/src/components/factory/unified-production/product-definitions-panel.tsx` (create/edit already route to canonical form — preserve)

**Maintenance**
- `apps/web/src/app/admin/maintenance/spare-parts/page.tsx` (link picker filtered to SPARE_PART; authority clarity)
- `apps/web/src/app/admin/maintenance/machine-parts/page.tsx` (preserve read-only)

**Shared / navigation / i18n**
- `apps/web/src/components/f9/lookup-adapters.ts` and `apps/web/src/components/f9/F9Lookup.tsx` (filter capability — existing `filters` prop reused)
- `apps/web/src/components/admin/shell/navigation-data.ts`
- `apps/web/src/lib/i18n/locales/{en,ar}/inventory.ts`, `navigation.ts`, `production.ts`, `maintenance.ts`

**Backend / schema / Excel**
- `apps/api/prisma/schema.prisma`, new migration under `apps/api/prisma/migrations/`
- `apps/api/src/modules/factory/products/*` (service, controller, DTOs, new `product-item-type.domain.ts`)
- `apps/api/src/modules/search/dto/search-query.dto.ts`, `search.service.ts`
- `apps/api/src/modules/maintenance/spare-parts/*` (link compatibility)
- `apps/api/src/modules/factory/master-data-excel/excel.definitions.ts`

---

## 3. Historical data classification (real production counts, read-only)

Query: `.tmp/phase1-classification.sql` / `.tmp/phase1-classification-exclusive.sql` against `ATsoftERP_DB` (SELECT only, integrated auth).

| Measure | Count |
|---|---|
| Total Product rows | **128** |
| Active Products | **120** |
| Soft-deleted Products | **8** |
| Active SpareParts | 397 |
| Active ProductionProductDefinitions | 108 |
| Material-requirement componentRole values in data | `RAW_MATERIAL` 40, `PACKAGING` 16 |

Evidence flags (active products): SparePart link 1; production definition 107; posted FG receipt 0; raw-material requirement 8; packaging requirement 2; no authoritative evidence 3; conflicting evidence 1.

**Mutually-exclusive backfill buckets (all 128 rows):**

| Bucket | Rows | Active | Deleted | Action |
|---|---|---|---|---|
| `SPARE_PART` (proven by `SparePart.productId`) | 1 | 1 | 0 | backfill `SPARE_PART` |
| `FINISHED_GOOD` (proven by active `ProductionProductDefinition`) | 106 | 106 | 0 | backfill `FINISHED_GOOD` |
| `RAW_MATERIAL` (proven by requirement/component role or material document/consumption) | 7 | 7 | 0 | backfill `RAW_MATERIAL` |
| `PACKAGING_MATERIAL` (proven by `componentRole = 'PACKAGING'` requirement line) | 2 | 2 | 0 | backfill `PACKAGING_MATERIAL` |
| `CONFLICT_REQUIRES_REVIEW` (FG definition **and** material-document evidence) | 1 | 1 | 0 | leave NULL, report only |
| `UNCLASSIFIED` (no authoritative evidence — 3 active QA/test + 8 deleted) | 11 | 3 | 8 | leave NULL, show `غير مصنف` |

No name-based guessing was used. `GENERAL` is **not** used as a lazy backfill. Conflicting and unclassified rows stay NULL and are correctable through the canonical form.

Conflict detail: `cmrlb0uf40002gg956cmv26mu` / `AT7-PROD-1784073037845` / "AT7 Test Product" — active production definition **and** material-document line.

---

## 4. Gap analysis summary

1. Dedicated `Product.itemType` field + DB constraint + index — **add**.
2. Evidence-based historical backfill with conflicts/unclassified left NULL — **add**.
3. New-product validation (required, allowed vocabulary) in DTO + service — **add**.
4. Type-change compatibility validation + itemType audit details — **add**.
5. SparePart↔Product link type enforcement in backend — **add**.
6. Server-side `itemType`/`itemTypes` filters on `/products` and `/search/product` — **add**.
7. Items page rename (`الأصناف`/`Items`), itemType column + filter chips — **add**.
8. Dynamic item form (itemType-first, type-specific sections, spare-part section read-only without spare-part permission) — **add**.
9. Production page title/scope clarity + FINISHED_GOOD default view — **add**.
10. Excel Product `Item Type` column + validation + round-trip — **add**.
11. AR/EN translations — **add**.

Already present and reused (no duplication): canonical Product identity/API/form, production config authorities, SparePart technical catalog, legacy read-only MachinePart, permission keys, audit service, F9 filter plumbing, Excel framework.
