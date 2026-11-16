# Maintenance Work Order DOCUMENT print reference proof

Date: 2026-11-12
Status: `COMPLETE` for the automated gate; native browser preview and physical paper `NOT_VERIFIED`.

## Scope

First approved operational print document from `docs/print/ATsoftERP-operational-print-justification.md`:

- Route: `/admin/maintenance/work-orders/[id]`
- Canonical source: `GET /maintenance-work-orders/:id`
- Existing permission: `maintenance-work-order:read`
- Mode: `DOCUMENT`, A4 portrait
- Shared engine only: `apps/web/src/lib/print.ts`, `PrintDocument.tsx`, `use-print-document.ts`, `print-runtime.tsx`

No backend endpoint, database model, migration, permission, numbering, workflow, inventory, cost or production-execution change was made. Print re-reads the canonical detail endpoint at print time and is read-only.

## Files

Created:

- `apps/web/src/components/print/maintenance-work-order-document-print.ts`
- `apps/web/tests/maintenance-work-order-document-print.test.ts`

Modified:

- `apps/web/src/app/admin/maintenance/work-orders/[id]/page.tsx` (Print action, print-time re-read)
- `apps/web/src/lib/admin-types/maintenance.ts` (`costCenter` relation already returned by the API)
- `apps/web/src/lib/i18n/locales/en|ar/reports.ts` (Work Order document scope/note)
- `apps/web/src/lib/i18n/locales/en|ar/maintenance.ts` (Work Order item label, general scope)
- `apps/web/src/lib/i18n/locales/en|ar/common.ts` (`printedOn` used by the existing request print page)
- `apps/web/src/app/admin/maintenance/requests/[id]/print/page.tsx` (existing wrong translation-key references corrected; no behavior change)

Documentation:

- `docs/print/ATsoftERP-operational-print-justification.md`
- `docs/print/ATsoftERP-print-standard.md`
- `docs/print/ATsoftERP-print-page-matrix.md`
- `docs/print/ATsoftERP-print-column-rules.md`
- `docs/print/ATsoftERP-print-rollout.md`
- `docs/print/ATsoftERP-print-validation.md`

## Printed content

Business identity and context: work-order number, title, description, status, type, priority, scope, machine, production line, component, cost center, work location, source request, warehouse, assigned technician, supervisor, creator, planned/started/completed/created/updated/cancelled dates and cancellation reason.

Parts: item code/name, quantity with its own unit, unit cost, total cost, localized issue status and issued quantity. Cost entries: localized type, description, amount, incurred date, creator. Summary: estimated/actual cost and part/cost-entry counts.

Excluded: `id`, `companyId`, `branchId`, `machineId`, `machineComponentId`, `productionLineId`, `costCenterId`, `requestId`, `warehouseId`, `assignedToId`, `supervisorId`, `createdById`, `lockVersion`, nested relation IDs, actions, navigation and application chrome.

Honesty rules: amounts print as numbers because the contract supplies no currency; quantities are never totalled across mixed or missing units; missing values are a dash, never a silent zero.

## Automated evidence

Focused suite:

```
cd apps/web
npm run test -- maintenance-work-order-document-print
1 suite / 8 tests PASS
```

Related print/work-order regression:

```
npm run test -- maintenance-work-order-document-print maintenance-request-document-print work-order-planned-parts work-order-request-guard-localization unified-print unified-print-runtime
6 suites / 56 tests PASS
```

Batch close re-ran the wider related set: **11 suites / 177 tests PASS**, and the full Web suite: **116 suites / 2185 tests PASS** (see the batch closeout proof).

The focused suite covers Arabic and English rendering, business number/title identity, metadata/context, parts and cost sections, empty-line behavior, technical-ID redaction, print-time canonical re-read, and denied print-time read.

Other gates:

| Gate | Result |
| --- | --- |
| `npm run typecheck` (web) | PASS |
| `npm run build:web` | PASS, exit 0, 194/194 pages |
| `npm run ui-baseline:check` | PASS (UI baseline, i18n, raw-key, permission-UI checks) |
| `npm run i18n:check` | 7018 EN / 7018 AR keys at batch close (7012/7012 at Work Order time), synchronized, no empty values |
| `npm run route-contract:check` | 1159 matched, 0 malformed/unresolved/mismatches |
| `git diff --check` | clean |

## Not verified

- Native browser print dialog, Save as PDF, cancellation and physical paper output.
- Field-level inspection of a paper/PDF render for this document.
- Full Web regression suite was not rerun at Work Order time; the batch close rerun recorded **116 suites / 2185 tests PASS** (see `maintenance-operational-print-batch-closeout-2026-11-12.md`).

## Git

No commit, push, merge, reset or branch operation was performed. The working tree remains dirty with pre-existing employee/mobile/production work plus the print implementation; unrelated changes were not modified or reverted.
