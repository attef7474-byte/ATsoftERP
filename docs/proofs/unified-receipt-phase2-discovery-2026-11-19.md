# Unified Inventory Receipt — Phase 2 Discovery Report

**Date:** 2026-11-19
**Baseline:** `main` @ `9149a1cbbcd8f17a3f60f38df6d7c0190bda78c2` (Phase 1 closeout), working tree clean, ahead/behind 0/0.
**Scope:** READ-ONLY discovery. No source file was changed by this report. Full raw inventories are in `.tmp/phase2-discovery/{01-operational-receipts,02-inventory-posting,03-fg-receipts,04-frontend-i18n,05-rules-checklist}.md`.

---

## 1. Phase 1 entry gate

| Concept | Verified state |
|---|---|
| Canonical `Product` item master | PRESENT — `Product.itemType` added in migration `20261119120000_add_product_item_type`, indexed (`schema.prisma:1675,1714`). |
| Item classification vocabulary | PRESENT — `apps/api/src/modules/factory/products/product-item-type.domain.ts:13-20` (6 types); web mirror `apps/web/src/lib/product-item-type.ts:10-17`. |
| Inventory page = الأصناف | PRESENT — `navigation.products` = `Items` / `الأصناف` (`en/ar/navigation.ts:27`). |
| Production Product page = إعداد المنتجات للإنتاج | PRESENT (Phase 1), distinct from `/admin/inventory/products`. |
| `SparePart` technical authority + canonical link | PRESENT — `SparePart.productId` nullable FK (`schema.prisma:2761-2762,2796`); Phase 1 preserved as authoritative link. |
| Product item-type filters | PRESENT — `ProductQueryDto.itemType` / `itemTypes` (`product-query.dto.ts:38-43`), used by spare-parts, production lines editors, FG editor. |
| Phase 1 deployed | PRESENT — runtime `4f36eec5`, deployed BUILD_ID `g6VifmDBRklyf7CqT50wF` (per Phase 1 deployment proof). |

**Gate result: PASS.** No Phase 1 gap to resolve.

---

## 2. Capability classification (required taxonomy)

| # | Capability | Classification | Evidence / authority |
|---|---|---|---|
| 1 | Ordinary warehouse receipts | **EXISTS — REUSE** | `InventoryOperationalReceipt` + `InventoryOperationalReceiptsService.post()` (`inventory-operational-receipts.service.ts:183-308`); creates `InventoryMovement` `STOCK_RECEIVING` / source `OPERATIONAL_RECEIPT`; IN balance effect via canonical engine. |
| 2 | FG receipt from production | **EXISTS — REUSE** | `ProductionFinishedGoodsReceipt` (`schema.prisma:5099-5177`), service `post()` (`production-finished-goods-receipts.service.ts:434-478`) → `postProductionFinishedGoodsMovementWithinTransaction` → cost-snapshot valuation. No external/purchased FG path exists. |
| 3 | Opening balances | **EXISTS — KEEP SEPARATE** | `InventoryOpeningBalance` (`schema.prisma:2083`); posting blocked while valuation ACTIVE; no UI change. |
| 4 | OperationalReceipt batch/serial/location/UOM today | **PARTIAL — LOCATION ONLY** | Header `locationId` validated + persisted to movement **line** `warehouseLocationId` (`:243`). Receipt **line** model has NO batch/serial/expiry/UOM columns (`:2346-2368`); movement line supports them (`:1982-2019`) but receipt never populates them. Product `unit` is display-only, 1:1 `quantityBase = quantity`. |
| 5 | Product selection filter by itemType | **EXISTS — REUSE** | `GET /products?itemType=` / `?itemTypes=` server-side; F9 `productAdapter` → `/products`; used at spare-parts page:346, production lines editors:100/125, FG editor:89/114. |
| 6 | Product selection filter by warehouse | **NOT REQUIRED / NOT SUPPORTED** | `ProductQueryDto` has no warehouse/company filter; company scope applied server-side. Product is global master — filtering by warehouse is not a canonical concept. |
| 7 | Stock balances physically posted | **EXISTS — REUSE (never bypass)** | `InventoryMovementsService.postMovementCore` (`inventory-movements.service.ts:550-816`): atomic DRAFT→POSTED claim (579-587), negative-stock guard (667-672), incremental balance update (805-809), Serializable isolation. All 13 inventory mutators are registered in `INVENTORY_MUTATOR_COVERAGE` (valuation constants:65-124). |
| 8 | Valuation applied | **EXISTS — REUSE** | `InventoryValuationEngineService` owns weighted moving average + monetary quartet. Operational receipt valued via `applyValuedReceipt` (needs explicit `unitCost`/`currencyCode` when warehouse policy ACTIVE — `:202-223`). FG valued from immutable `ProductionRunCostSnapshot` (`inventory-movements.service.ts:1041-1300`). |
| 9 | Receipt lifecycle | **EXISTS — KEEP** | Operational: `DRAFT→SUBMITTED→APPROVED→POSTED`, plus `REJECTED`, `CANCELLED`; edit/line-mutate/delete DRAFT only. FG: `DRAFT→POSTED`, `CANCELLED`, `POSTED→REVERSE(new DRAFT OUT receipt)`. FG has **no** submit/approve/reject. |
| 10 | Approval actors | **EXISTS — REUSE** | Operational header stores `createdById`, `submittedById`, `approvedById`, `rejectedById`, `postedById`, `cancelledById` + timestamps. FG stores `createdById`, `postedById`, `cancelledById` (scalar). |
| 11 | Warehouse/location tenant validation | **EXISTS — REUSE** | `assertWarehouseInContext` / `assertRowInContext` (`tenant-guards.ts:11-43`); location→warehouse membership checked in create/update/post of every receipt flow. |
| 12 | Numbering | **EXISTS — REUSE** | `NumberingService.generateNumberAtomicWithClient(code, client)`. Receipt codes `OR-` (`OPERATIONAL_RECEIPT`), FG `PFR-` (`PRODUCTION_FINISHED_GOODS_RECEIPT`), movement `IM-` (`INVENTORY_MOVEMENT`). Distinct sequences preserved. |
| 13 | Exact gaps for unified receiving UI | **MISSING — ADD** | (a) No `/admin/inventory/receipts` route/page; (b) no `receiptType`/`receiptSource` field on `InventoryOperationalReceipt` → unified list cannot show/filter normalized type/source without fragile derivation; (c) no server-side itemType enforcement on operational receipt create/lines; (d) no no-duplicate-authority orchestration read API; (e) no `receiving.*` i18n keys; (f) no inventory nav entry for any receipt. |

---

## 3. Answer to the 13 mandatory discovery questions

1. **Ordinary warehouse receipt authority:** `InventoryOperationalReceipt` (operational receipt). Only implemented non-production receiving authority. Purchasing `goods-receipts.controller.ts` / `.module.ts` are empty (0 lines).
2. **FG production receipt authority:** `ProductionFinishedGoodsReceipt`; requires order + run; output product from `ProductionProductDefinition.productId`; cost from frozen `ProductionRunCostSnapshot`.
3. **Opening balances:** separate `InventoryOpeningBalance`; blocked while valuation ACTIVE; not to be merged into daily receiving.
4. **OperationalReceipt batch/serial/location/UOM:** location YES (header→movement line), batch/serial/expiry NO on receipt line, UOM NO (Product.unit display only, 1:1 base quantity).
5. **Product filter by itemType:** YES, server-side (`itemType`, `itemTypes`).
6. **Product filter by warehouse:** NO and not required (global item master; company scope server-side).
7. **Physical balance posting:** canonical `InventoryMovementsService.postMovementCore`, atomic, Serializable, incremental balance update, negative-stock guard.
8. **Valuation:** engine-owned; operational receipt needs explicit cost for ACTIVE warehouse; FG derives from frozen production cost snapshot.
9. **Lifecycle:** as §2 row 9.
10. **Approval actors:** as §2 row 10; separation preserved.
11. **Warehouse/location tenant validation:** shared guards + in-transaction revalidation.
12. **Numbering:** code-keyed atomic sequences, distinct per authority.
13. **Gaps:** as §2 row 13.

---

## 4. APIs capable of increasing physical inventory (complete list)

Through canonical poster: generic movement `post`, production material RETURN, production FG receipt, (OUT only) FG issue / spare-part issue.
Direct balance mutators (preserved, untouched): opening balances, stock adjustments, stock transfers, operational receipts, physical counts, legacy adjustments, maintenance stock return, balance recalculate.
**Phase 2 adds NO new inventory mutation path.** It only: (i) adds optional server-side itemType validation + two nullable classification columns on the existing operational receipt authority; (ii) adds a READ-ONLY orchestration list endpoint; (iii) adds a UI that calls the two existing native create endpoints.

---

## 5. Architectural decision

**Unify the UI, not the authorities.**

- One user-facing route `/admin/inventory/receipts` — "*إذن استلام* / Receipt Voucher", first field `*نوع الاستلام* / Receipt Type`.
- The six receipt types map to exactly two native authorities:
  - `RAW_MATERIAL`, `SPARE_PART`, `PACKAGING_MATERIAL`, `CONSUMABLE`, `GENERAL` → `POST /inventory/operational-receipts`.
  - `FINISHED_GOOD` → `POST /production/finished-goods-receipts`.
- No new persisted "generic receipt" table. No new stock balance authority. No `Product.quantity` / `Product.stock` / `SparePart.quantity`. No quantity fields on Product.
- Native status, numbering, actors, audits, valuation, post locks and reversal remain intact.
- Old routes preserved: `/admin/inventory/operational-receipts` stays as the native advanced view; `/admin/production/finished-goods-receipts` stays as its existing redirect to the production workspace.

---

## 6. Schema impact decision

One **additive, nullable, backward-compatible** migration on `InventoryOperationalReceipt`:

- `receiptType String?` — normalized receipt type from the unified form. NULL = legacy/native operational receipt.
- `receiptSource String?` — normalized source (SUPPLIER / RETURN / INTERNAL / OTHER). NULL = legacy/unspecified.

Justification: required for accurate normalized unified-list rows and server-side `type`/`source` filters without deriving business facts from mutable Product itemType; enables backend itemType enforcement anchored on the document itself. No backfill required (NULL is a valid legacy state). No destructive change. Rollback = drop the two columns (data preserved in application-independent form; no existing rows affected).

`FG receipt` needs no schema change (type is inherent; source is production).

---

## 7. Validation commands identified

`npx prisma validate`, `npx prisma generate`, API typecheck/build, Web typecheck/build, focused Jest suites (API + Web), `npm run test:web-logic`, `npm run i18n:check`, `npm run raw-keys:check`, `npm run ui-baseline:check`, `git diff --check`.
