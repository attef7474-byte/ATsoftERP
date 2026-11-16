# Maintenance Request DOCUMENT print reuse proof

Date: 2026-11-12
Status: `EXISTING_DOCUMENT_REUSED`; no rebuild was performed.

## Decision

The Maintenance Request print route was reviewed during the P0 Maintenance batch and classified `EXISTING_DOCUMENT_REUSED` rather than rebuilt:

- Route: `/admin/maintenance/requests/[id]/print`
- Canonical source: `GET /maintenance/requests/:id/print`
- Existing permission: `maintenance-request:print`
- Renderer: shared engine (`usePrintDocument` + `maintenanceRequestDocumentModel` + `PrintDocument`)
- Mode: `DOCUMENT`, A4 portrait

The route already prints through the shared engine and already re-reads the canonical print endpoint at print time. Rebuilding it would have created a duplicate document family and discarded accepted work, so only a missing regression assertion and documentation were added.

## Why it passes the business print test

1. **Business artifact** — a maintenance request is handed to the maintenance team, filed with the machine history and used to authorise execution and cost.
2. **Stable identity** — `requestNumber` is generated and printed as the document number.
3. **Canonical source** — one dedicated print endpoint, read again at print time; the browser never recomputes business facts.
4. **Independent paper** — company/branch context, status, request data, description, tasks, parts, cost entries and downtime are all printed; the page is useful without application navigation.
5. **Safe scope** — the existing `maintenance-request:print` permission plus the authenticated company/branch context; no new permission or tenant weakening.

## Security and tenancy proof

- Controller: `maintenance-requests.controller.ts` requires `@Permissions('maintenance-request:print')` on `GET :id/print`.
- Service: `getPrintData(id, ctx)` calls `findOne(id, ctx)` first. `findOne` queries `maintenanceRequest` with `deletedAt: null` and `machine: this.machineScope(ctx)`, so a request whose machine is outside the active company/branch (or outside the allowed branch-null scope) is not returned.
- Child collections (parts, cost entries, tasks, downtime) are queried by the already-authorised `requestId`. They cannot widen access to another tenant because the parent read has already been scoped.
- The print-time read is the same endpoint and permission as the page. A denied read aborts before the document opens.

## Added regression assertion

The existing suite covered AR/EN rendering, identity, sections, empty lines, technical-ID redaction, the print action and the denied read. One gap remained: it did not prove that printing re-reads the endpoint instead of reusing the React state captured on screen.

Added to `apps/web/tests/maintenance-request-document-print.test.ts`:

- the page loads the print endpoint once, then printing issues a second read (2 calls total, both to `/maintenance/requests/req-1/print`);
- the document is built from the fresh payload (the print model carries the description returned by the second read);
- the document still opens exactly once with the correct business number.

No assertion was removed or weakened.

## Evidence

```
cd apps/web
npx jest --config tests/jest.config.js maintenance-request-document-print
1 suite / 8 tests PASS
```

Full Web regression at batch close: **116 suites / 2185 tests PASS**.

Related gates at batch close: typecheck PASS, Web build PASS, i18n 7018/7018 keys synchronized, UI baseline/raw-key/permission-UI PASS, route contract 1159 matched / 0 mismatches, `credentials:check` PASS, `git diff --check` clean, U+FFFD scan clean.

## Limitations

- Native browser print dialog and physical paper for the existing request document were not re-verified in this batch; they belong to the earlier accepted request print work.
- The API was not running, so no live request was printed during this review.

## Sentinels

`DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `API_BUSINESS_MUTATION = 0`, `PERMISSION_CHANGE = 0`, `MAINTENANCE_STATUS_CHANGE = 0`, `INVENTORY_QUANTITY_DELTA = 0`, `PRODUCTION_DELTA = 0`.

## Git

No commit, push, merge, reset or branch operation was performed.
