# Maintenance Repair Order DOCUMENT print proof

Date: 2026-11-12
Status: `COMPLETE` for the automated and PDF-render gate; native browser preview and physical paper `NOT_VERIFIED`.

## Scope

Second approved operational print document from `docs/print/ATsoftERP-operational-print-justification.md`:

- Route: `/admin/maintenance/repair-orders/[id]`
- Canonical source: `GET /maintenance/repair-orders/:id`
- Existing permission: `repair-orders:read` (no new permission, no `repair-order:print`)
- Mode: `DOCUMENT`, A4 portrait
- Shared engine only: `apps/web/src/lib/print.ts`, `PrintDocument.tsx`, `use-print-document.ts`, `print-runtime.tsx`

No backend endpoint, database model, migration, permission, numbering, workflow, inventory, cost or production-execution change was made. The print action re-reads the canonical detail endpoint at print time and is read-only.

## Files

Created:

- `apps/web/src/components/print/maintenance-repair-order-document-print.ts`
- `apps/web/tests/maintenance-repair-order-document-print.test.ts`

Modified:

- `apps/web/src/app/admin/maintenance/repair-orders/[id]/page.tsx` (Print action with `repair-orders:read`, print-time re-read)
- `apps/web/src/lib/i18n/locales/en|ar/maintenance.ts` (`repairRecord`, `repairRecordField`, `repairRecordValue`, `duration`; `durationMinutes` reused from the existing key)
- `apps/web/src/lib/i18n/locales/en|ar/reports.ts` (`repairOrderDocumentScope`, `repairOrderDocumentNote`)

Documentation:

- `docs/print/ATsoftERP-operational-print-justification.md`
- `docs/print/ATsoftERP-print-standard.md`
- `docs/print/ATsoftERP-print-page-matrix.md`
- `docs/print/ATsoftERP-print-column-rules.md`
- `docs/print/ATsoftERP-print-rollout.md`
- `docs/print/ATsoftERP-print-validation.md`

## Printed content

Identity and context: repair-order number, spare-part code/name, status, source condition, target condition, source/reserved/repaired/scrapped/remaining quantities, warehouse, machine, component, source maintenance request, external-repair flag/provider, opened/inspection/repair/test/completed/cancelled/created/updated dates.

Repair record: inspection result, failure description, repair description, test result, test notes, cancellation reason, recorded notes.

Actions: action type, action status, description, result, performed date/time, duration in minutes.

Conditional summary: estimated repair cost and actual repair cost only when recorded, plus the action count.

Excluded: `id`, `repairOrderId`, `sparePartId`, `productId`, `warehouseId`, `machineId`, `machineComponentId`, `maintenanceRequestId`, `replacementHistoryId`, `installedPartId`, `conditionInMovementId`, `conditionOutMovementId`, `inventoryScrapMovementId`, `openedByUserId`, `inspectedByUserId`, `repairedByUserId`, `testedByUserId`, `closedByUserId`, `performedByUserId`, `sourceType`/`sourceId`, `lockVersion`, nested relation IDs, actions/navigation, application chrome.

Performer identity is omitted entirely because the canonical detail contract exposes only `performedByUserId`, never a display name. Printing a raw user id would violate the document rule, so no performer column is invented.

Honesty rules: quantities are printed per line in the source part unit and never converted; estimated/actual amounts print only when recorded and as numbers because the repair-order contract supplies no currency; missing optional values are omitted, not printed as placeholder text.

## Automated evidence

Focused suite:

```
cd apps/web
npx jest --config tests/jest.config.js maintenance-repair-order-document-print
1 suite / 9 tests PASS
```

Coverage maps to the approved test plan:

| Test | Coverage |
| --- | --- |
| RO-P01/P02/P03/P04/P05/P06 | Arabic and English document, business number, company/branch context, source part, request/machine/component/warehouse, repair record, action table |
| RO-P03 reject | Missing/blank `repairOrderNumber` or missing `sparePart` throws `PrintPreparationError('unavailable')` |
| RO-P05/P08 | No raw source/movement/user/relation identifiers and no raw `sourceType` in the HTML |
| RO-P07 | Estimated/actual cost printed only when recorded |
| RO-P07/P11 | Unrecorded optional fields and empty narrative/action sections are omitted; no placeholder dash |
| RO-P12 | Model values and printable HTML agree in both locales |
| RO-P09 | Print action re-reads the canonical detail (2 reads: page load + print) and prints the fresh value |
| RO-P10 | A denied print-time read opens no document and shows the error dialog |

Related Maintenance/print regression:

```
11 suites / 177 tests PASS
```

(`maintenance-request-document-print`, `maintenance-work-order-document-print`, `maintenance-repair-order-document-print`, `repair-order-actions`, `repair-order-r2g`, `repair-order-action-labels`, `unified-print`, `unified-print-runtime`, `maintenance-requests-print-flow`, `maintenance-raw-enum-localization-r2`, `maintenance-module-terminology`)

## PDF render evidence

Method: the actual `maintenanceRepairOrderDocumentModel` + actual `PrintDocument` + actual shared `printDocumentCss`, rendered with WeasyPrint 70.0 and inspected with PyMuPDF. Fixtures are in-memory only: zero database reads/writes and zero API calls. This is render validation, not native browser proof.

| Case | Pages | A4 portrait | Text bounds | No chrome | No technical IDs | Business number | Part/source identity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| actual AR | 2 | PASS | PASS | PASS | PASS | PASS | PASS |
| empty AR | 1 | PASS | PASS | PASS | PASS | PASS | PASS |
| multipage AR | 7 | PASS | PASS | PASS | PASS | PASS | PASS |
| actual EN | 2 | PASS | PASS | PASS | PASS | PASS | PASS |
| empty EN | 1 | PASS | PASS | PASS | PASS | PASS | PASS |
| multipage EN | 8 | PASS | PASS | PASS | PASS | PASS | PASS |

Additional English layout checks: 0 text-block collisions on actual/empty/multipage; multipage action rows 1..60 appear exactly once; the table header repeats on each action page (pages 2-7); page 8 carries the notes only, which is not a defect. The empty document contains no placeholder `—`, no empty sections, and omits the unset warehouse/machine/request/dates.

Evidence:

- `.tmp/unified-print/maintenance-repair-order-render-manifest.json`
- `.tmp/unified-print/maintenance-repair-order-pdf-inspection.json`
- `.tmp/unified-print/maintenance-repair-order-layout-inspection.json`
- `docs/print/proofs/maintenance-repair-order-{actual,empty,multipage}-{ar,en}.pdf`
- `docs/print/proofs/maintenance-repair-order-*-page-*.png`
- `docs/print/proofs/maintenance-repair-order-actual-{ar,en}-text.txt`

## Gates at batch close

| Gate | Result |
| --- | --- |
| Full Web regression | 116 suites / 2185 tests PASS |
| `npm run typecheck` (all workspaces) | PASS |
| `npm run build:web` | PASS |
| `npm run i18n:check` | PASS, 7018 EN / 7018 AR keys, synchronized, no empty values |
| `npm run ui-baseline:check` | PASS (UI baseline, i18n, raw-key, permission-UI) |
| `npm run route-contract:check` | 1159 matched, 0 malformed/unresolved/mismatches |
| `npm run credentials:check` | PASS |
| `git diff --check` | clean |
| U+FFFD scan of changed/new files | clean |

## Not verified

- Native browser print dialog, Save as PDF, print cancellation and physical paper output for the Repair Order document.
- Field-level visual review of the rendered PNG pages by a human; this session inspected PDF text, bounds, collisions and page structure programmatically.
- Live canonical data: the API was not running, so no live repair order was printed. Every PDF fixture is explicitly labelled in-memory.

## Sentinels

| Sentinel | Value |
| --- | --- |
| `DATABASE_WRITE` | `0` |
| `PRISMA_SCHEMA_CHANGE` | `NONE` |
| `MIGRATION` | `NONE` |
| `API_BUSINESS_MUTATION` | `0` |
| `PERMISSION_CHANGE` | `0` |
| `MAINTENANCE_STATUS_CHANGE` | `0` |
| `INVENTORY_QUANTITY_DELTA` | `0` |
| `PRODUCTION_DELTA` | `0` |

## Git

No commit, push, merge, reset or branch operation was performed. The working tree remains dirty with pre-existing print/report, employee-registration, mobile-login and production-closeout work; unrelated changes were not modified or reverted.
