# Inventory Count DOCUMENT print — 2026-11-13

Status: **INVENTORY_COUNT_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED**

Scope: Phase 3 inventory operational print, Inventory Count document only. The shared print engine, the accepted report rollout, the accepted Maintenance operational print batch, and the closed Inventory Opening Balance and Inventory Movement work were not rebuilt or re-audited. No Adjustment, Stock Adjustment, Ledger, Reconciliation, Balances register or Production Material Document was started. No database write, schema change, migration, API change or permission change was made.

## 1. Approval and classification

- Business artifact: Inventory Count document / count results sheet.
- Classification: `DOCUMENT`.
- Decision: `APPROVE` (implemented, automated PASS), recorded in `docs/print/ATsoftERP-operational-print-justification.md`.
- Gate satisfied: the canonical count read exists, the artifact carries a business number (`countNumber`), and the existing read permission plus authenticated company/branch/warehouse scope are sufficient.
- No new frontend route was required: `/admin/inventory/counts/[id]` already existed and gained a Print action.

## 2. Family selection (two count families exist)

| Family | Route | Model | Decision |
| --- | --- | --- | --- |
| `InventoryCount` | `/admin/inventory/counts` and `[id]` | `InventoryCount` / `InventoryCountLine` | **Printed** (this phase) |
| `InventoryPhysicalCount` | `/admin/inventory/physical-counts` and `[id]` | `InventoryPhysicalCount` / `InventoryPhysicalCountLine` | **Deferred**, not printed |

Rationale for the chosen family:

- `/admin/inventory/counts` is the navigation-integrated count (`inv-counts` in `navigation-data.ts`) and is cross-linked from barcode quick links, adjustments, F9 and search. It is the count surface already classified in the print audit and justification documents.
- `InventoryPhysicalCount` has its own submit/approve/reject/post workflow and posts `COUNT_VARIANCE_IN/OUT` movements on post. Printing both families would create a duplicate count-document family, which the print program forbids.
- The relationship is recorded as a separate deferred workflow; `/admin/inventory/physical-counts` is not marked complete anywhere.

## 3. Canonical source audit

- Canonical detail endpoint: `GET /inventory/counts/:id` (`inventory-counts.controller.ts` → `inventory-counts.service.ts#findOne`).
- Print-time document read: `GET /inventory/counts/:id/results` (`#results`).
- Permission: `inventory-count:read` (existing; not changed).
- Tenancy: `findOne` uses `countByIdScope` (`id` + `countScope`), where `countScope` requires the active `companyId` and `branchId` and nests `warehouseScope` (company, not deleted, branch-null-or-active). `assertRowInContext` enforces company always and branch when set. It is not a naked-ID fetch.
- Print-read rationale: `#results` calls `findOne(id, ctx)` (same scope) and then queries lines with `countId` plus `count: this.countScope(ctx)`. It is the only authorized count read that returns `product.unit`; the legacy `GET /inventory/counts/:id` select is `{ id, code, name }` only. A backend contract change is out of scope for this phase, so print uses the count-scoped results read instead of widening the API. The adapter therefore receives `{ count, lines }` and reads only business fields from it.
- Payload used: `countNumber`, `status`, `countDate`, `startedAt`, `completedAt`, `cancelledAt`, `createdAt`, `updatedAt`, `notes`, company, branch, warehouse, and lines with `systemQty`, `countedQty`, `differenceQty`, `status`, `notes`, `product { code, name, unit }`, `warehouseLocation { code, name }`.
- Line ordering: `#results` returns lines without `orderBy`; the adapter sorts deterministically by product code, then location code, then internal line id. The internal id is a tie-break only and is never rendered.
- No new endpoint, DTO, service method, permission, schema or migration was added.

## 4. Domain semantics that constrain the document

- Book/system quantity: `InventoryCountLine.systemQty` is captured when the line is created from the current `InventoryBalance` (or through an authorized explicit `systemQty` override) and is never refreshed afterwards. The document prints that stored value and never reads or substitutes a current balance. The focused test injects a live-balance projection (`9999`) and asserts it never appears.
- Difference: `differenceQty` is stored by the count-line service as `countedQty - systemQty`. The document prints the recorded value with that sign and never recalculates it, never takes an absolute value and never re-derives it from current stock.
- Count line statuses: `PENDING | COUNTED | VERIFIED`; count statuses: `DRAFT | IN_PROGRESS | COMPLETED | CANCELLED`. Both are localized.
- Counter/verifier accountability: `countedById` / `verifiedById` are bare ids with no user relation in the canonical read, so readable counter/verifier names are not available. They are omitted rather than replaced with ids.
- Zero-line counts are allowed by the contract; the adapter renders a localized empty state.
- The count stores no movement/adjustment number, so no posting reference is invented.
- No blind-count support was found: no blind flag, hidden expected quantity, variance mask, recount pass, per-counter queue or per-counter private results exist in the model, service, DTOs, controller, detail page or list page. Both count detail screens always show system/counted/variance to a `inventory-count:read` holder.

## 5. `BLIND_COUNT_MODEL` and print visibility

- `BLIND_COUNT_MODEL = NOT_SUPPORTED`.
- `BLIND_COUNT_PRINT_SECURITY = NOT_APPLICABLE`.
- `PRINT_VISIBILITY <= EXISTING_AUTHORIZED_UI/API_VISIBILITY`: the document prints exactly the fields the authorized count screen already shows (system, counted, difference, status, product, unit, location, notes). It adds no field and reveals no hidden value.
- The Print action is registered with `inventory-count:read` and is enabled only when the record loaded; the print-time read is the same permission that renders the screen. A denied read aborts before any document opens (tested).
- The second physical-count family keeps its own `inventory:physical-count:*` permissions and remains unprinted.

## 6. Implementation files

Created:

- `apps/web/src/components/print/inventory-count-document-print.ts` — typed DOCUMENT adapter: A4 portrait, required business number, localized metadata/summary/sections/notes, snapshot-only system quantity, recorded difference, per-line UOM, conditional readable location and line-note columns, sorted rows, localized empty state.
- `apps/web/tests/inventory-count-document-print.test.ts` — focused suite IC-P01–IC-P24 mapped across 19 executed tests.

Modified:

- `apps/web/src/app/admin/inventory/counts/[id]/page.tsx` — added the Print action gated by `inventory-count:read`, print-time read of `GET /inventory/counts/:id/results`, and a disabled state while printing.
- `apps/web/src/lib/i18n/locales/en/reports.ts` and `ar/reports.ts` — added `printDocument.countDocumentScope` and `printDocument.countDocumentNote`.

Documentation updated: `docs/print/ATsoftERP-operational-print-justification.md`, `ATsoftERP-print-page-matrix.md`, `ATsoftERP-print-column-rules.md`, `ATsoftERP-print-validation.md`, `ATsoftERP-print-rollout.md`, `ATsoftERP-print-standard.md`.

Temporary proof assets (outside git): `.tmp/unified-print/count-document-proof.cjs`, `.tmp/unified-print/inspect-count-document-pdfs.py`, `.tmp/unified-print/inventory-count-document-render-manifest.json`, `.tmp/unified-print/inventory-count-document-pdf-inspection.json`.

## 7. What the document prints

- Count number (`countNumber`), required; the model refuses to render without it.
- Localized count status and localized line statuses.
- Company and branch from the authenticated operational context; the one count warehouse as `[code] name`.
- Count date, started/completed/cancelled/created/updated dates (localized, LTR-isolated; missing optional dates omitted).
- Line count, counted-line count and verified-line count.
- One lines section: row number, product code, product name, stored system quantity, counted quantity, recorded difference, recorded unit, line status, and — only when at least one line carries them — readable location and line notes.
- A scope/limitation note plus user notes (line-split).
- Runtime print date/time, timezone, printed-by and company/branch footer.

Never printed: `id`, `countId`, `companyId`, `branchId`, `warehouseId`, `warehouseLocationId`, `productId`, `countedById`, `verifiedById`, `createdById`, `startedById`, `completedById`, `cancelledById`, `lockVersion`, `_count`, raw permissions, tokens, passwords, application chrome, cost, currency, lot/batch/serial, a document quantity total, a mixed-UOM sum, a recomputed variance or a valuation.

Rationale: quantities are recorded values in each line's own recorded unit. Summing mixed or missing units would be misleading and no canonical document quantity total exists. Cost/valuation facts exist in adjacent inventory surfaces but are not part of the count contract and must not be inferred. Counter/verifier names are unavailable, so accountability is carried by the audit trail rather than an invented identity on paper. The count model has no count-type or count-method field, so no type label is printed and none is invented; the count status and line statuses carry the document state.

## 8. Tests

- Focused suite `apps/web/tests/inventory-count-document-print.test.ts`: **1 suite / 19 tests PASS** (IC-P01–IC-P24 mapped across 19 executed tests).
- Related regression (`inventory-count-document-print`, `inventory-count-variance-print`, `inventory-movement-document-print`, `inventory-opening-balance-document-print`, `unified-print`, `unified-print-runtime`, `navigation-permission-inventory`, `action-permission-inventory`, `inventory-valuation-r1d-ui`): **9 suites / 111 tests PASS**.
- Fresh full Web regression `npm test --workspace apps/web`: **119 suites / 2234 tests PASS**.

Coverage includes: AR/EN model parity, required business number, status/line-status localization, readable warehouse/location without ids, snapshot-only system quantity, recorded difference sign, no blind/recount fields, omitted counter identities, no mixed-UOM total, technical-ID/sensitive-data/chrome redaction, localized empty state, exactly-once multipage rows, runtime print timestamp, print-time canonical re-read, and denied-read abort.

## 9. PDF proof

Renderer: the real `inventoryCountDocumentModel`, the real `PrintDocument` component and the real shared `printDocumentCss`, driven by `.tmp/unified-print/count-document-proof.cjs`. **Fixtures are in-memory only**: zero database writes, zero API calls, zero inventory mutations. The API was not running during this batch, so no live canonical record was used.

| PDF | Locale | Mode | Pages | Bytes |
| --- | --- | --- | --- | --- |
| `inventory-count-document-actual-ar.pdf` | AR | actual | 1 | 23458 |
| `inventory-count-document-actual-en.pdf` | EN | actual | 1 | 15660 |
| `inventory-count-document-empty-ar.pdf` | AR | empty | 1 | 19292 |
| `inventory-count-document-empty-en.pdf` | EN | empty | 1 | 12730 |
| `inventory-count-document-multipage-ar.pdf` | AR | 120 lines | 8 | 64104 |
| `inventory-count-document-multipage-en.pdf` | EN | 120 lines | 8 | 57164 |

Inspection (`.tmp/unified-print/inspect-count-document-pdfs.py`):

- A4 portrait 595.28 × 841.89 pt on every page.
- All text blocks inside the printable canvas; no blank page.
- No `<button|input|select|nav>`, `lockVersion`, `companyId`/`branchId`/`warehouseId`/`locationId`/`productId`/`countId`/`countedById`/`verifiedById`/`createdById`/`startedById`/`completedById`/`cancelledById`, CUID/UUID, `NaN`, `Invalid Date`, untranslated keys, `undefined` or `null`.
- No fixture cost (`48321.75`), currency (`USD`), lot (`LOT-77`) or serial (`SN-9`) data.
- Business number, company and branch present; the one warehouse `[code] name` present when applicable.
- Actual case: each of `ITEM-001`–`ITEM-004` appears exactly once; recorded units `PCS`, `KG`, `L` printed per line; English PDF shows the stored snapshot/recorded values `25`, `20`, `4`, `6`, `-5`, `2`, `-8` and never `9999`; no document quantity total.
- Empty case: localized empty state present.
- Multipage case: 8 pages per language; every one of 120 product codes appears exactly once; table headers repeat on every page with rows.
- The shared engine wraps long header words inside narrow columns (`Counted Qty`, `Status`). This is pre-existing accepted engine/layout behaviour also visible in the accepted Movement document; it is not a Count regression and the engine was not rebuilt.

## 10. Runtime proof ledger

| Requirement | Result |
| --- | --- |
| AR document | PASS (automated render + PDF text inspection) |
| EN document | PASS (automated render + PDF text inspection) |
| A4 portrait | PASS |
| Multipage, exactly-once lines | PASS (8 pages × 2 languages, 120 lines) |
| Empty state | PASS (localized AR/EN) |
| Blind-count security | `NOT_APPLICABLE` (`BLIND_COUNT_MODEL = NOT_SUPPORTED`, audit documented) |
| Historical system-quantity snapshot | PASS (stored `systemQty`, decoy live balance rejected) |
| Variance semantics/sign | PASS (recorded `countedQty - systemQty`) |
| UOM safety | PASS (per-line unit, no cross-unit total) |
| Tenant/company/branch scope | Backend-enforced by `countScope`/`findOne`; document adds no scope field |
| Canonical re-read at print time | PASS (test proves one results read per print) |
| Exactly-once line coverage | PASS |
| Zero business writes | PASS (`DATABASE_WRITE = 0`, GET-only) |
| Native browser preview | `NOT_VERIFIED` |
| Native Save-as-PDF | `NOT_VERIFIED` |
| Print cancellation | `NOT_VERIFIED` |
| Physical paper | `NOT_VERIFIED` |
| Human visual review of PNG pages | `NOT_VERIFIED` (programmatic inspection only) |
| Live canonical count record | `NOT_VERIFIED` (in-memory fixtures) |

## 11. Gates

- All-workspace typecheck: PASS (`tsc --noEmit` for API and Web).
- Web production build: PASS, 194/194 pages, exit 0; `/admin/inventory/counts/[id]` emitted.
- i18n check: PASS, **7057 EN / 7057 AR**, all namespaces registered, no empty values, all literal `t()` keys resolve.
- Raw-key safety: PASS.
- UI baseline: PASS, 99 checks; permission-UI check PASS.
- `npm run route-contract:check`: PASS, 1163 matched / 0 malformed / 0 unresolved / 0 mismatches.
- `npm run credentials:check`: PASS.
- `git diff --check`: clean.
- U+FFFD scan on changed Count files: clean.

## 12. Zero-write sentinels

`DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `API_BUSINESS_MUTATION = 0`, `PERMISSION_CHANGE = 0`, `INVENTORY_QUANTITY_DELTA = 0`, `MAINTENANCE_STATUS_CHANGE = 0`, `PRODUCTION_DELTA = 0`.

Print is GET-only and re-reads the canonical count source at print time. No count, count line, balance, movement, audit or workflow record was created or mutated by this phase.

## 13. Not verified

- Native browser preview of the Print/PDF dialog.
- Native Save-as-PDF.
- Print cancellation behaviour.
- Physical paper output.
- Human visual review of the rendered PNG pages. Evidence is programmatic PDF text/bounds/raster inspection; the current environment cannot view raster images.
- Live canonical record: all PDFs are explicitly labelled in-memory fixtures.
- The `InventoryPhysicalCount` family is not printed and remains a separate deferred workflow.
- The `/admin/inventory/counts` list is not printed and remains `AUDITED / NOT_VERIFIED (list)`.

These must remain `NOT_VERIFIED` until the owner or a manual review records concrete evidence.

## 14. Evidence paths

- Focused test: `apps/web/tests/inventory-count-document-print.test.ts`.
- Adapter: `apps/web/src/components/print/inventory-count-document-print.ts`.
- Page wiring: `apps/web/src/app/admin/inventory/counts/[id]/page.tsx`.
- Render script: `.tmp/unified-print/count-document-proof.cjs`.
- PDF inspector: `.tmp/unified-print/inspect-count-document-pdfs.py`.
- Manifests: `.tmp/unified-print/inventory-count-document-render-manifest.json`, `.tmp/unified-print/inventory-count-document-pdf-inspection.json`.
- PDFs/PNGs/text: `docs/print/proofs/inventory-count-document-*`.

## 15. Documentation updated

Only the Count-relevant rows and sections of the six print documents were updated. Adjustment, Stock Adjustment, Ledger, Reconciliation, Balances register and Production Material Document are not documented as complete.

## 16. Git

Branch `main`, HEAD `54e3706f`. No commit, push, merge, reset, branch, tag or staging was performed. The worktree already contained unrelated employee/mobile/production changes plus prior print work; they were preserved. The Inventory Count changes are classified `PRINT_INVENTORY_COUNT`.
