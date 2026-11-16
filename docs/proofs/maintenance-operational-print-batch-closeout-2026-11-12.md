# Maintenance operational print batch closeout

Date: 2026-11-12
Status: `MAINTENANCE_OPERATIONAL_PRINT_COMPLETE` for the automated/PDF gate; native browser previews and physical paper remain owner-manual and `NOT_VERIFIED`.

## Batch scope

| Surface | Classification | Decision | Evidence |
| --- | --- | --- | --- |
| `/admin/maintenance/work-orders/[id]` | `DOCUMENT` | Implemented | `docs/proofs/maintenance-work-order-document-print-2026-11-12.md` |
| `/admin/maintenance/repair-orders/[id]` | `DOCUMENT` | Implemented | `docs/proofs/maintenance-repair-order-document-print-2026-11-12.md` |
| `/admin/maintenance/requests/[id]/print` | `DOCUMENT` | `EXISTING_DOCUMENT_REUSED` (no rebuild) | `docs/proofs/maintenance-request-document-print-reuse-2026-11-12.md` |
| `/admin/maintenance/tasks` and execution sub-routes | `NOT_PRINTABLE` | Rejected for this batch; revisit only with a numbering/document contract | `docs/proofs/maintenance-tasks-print-classification-2026-11-12.md` |
| `/admin/maintenance/spare-part-issues` | `DOCUMENT` | `SPARE_PART_ISSUE_DEFERRED_SOURCE_INCOMPLETE` | `docs/print/ATsoftERP-operational-print-justification.md` |

No inventory operational document was started. Opening Balance remains the next domain after this batch.

## Automated gates (fresh at batch close)

| Gate | Result |
| --- | --- |
| Full Web regression (`npx jest --config tests/jest.config.js`) | **116 suites / 2185 tests PASS** |
| Work Order focused suite | 1 suite / 8 tests PASS |
| Repair Order focused suite | 1 suite / 9 tests PASS |
| Maintenance Request focused suite (including new print-time re-read test) | 1 suite / 8 tests PASS |
| Related Maintenance/print regression | 11 suites / 177 tests PASS |
| `npm run typecheck` (API + Web) | PASS |
| `npm run build:web` | PASS |
| `npm run i18n:check` | PASS, 7018 EN / 7018 AR keys, 22 namespaces, no empty values |
| `npm run ui-baseline:check` | PASS (UI baseline, i18n, raw-key, permission-UI) |
| `npm run route-contract:check` | 1159 matched, 0 malformed / 0 unresolved / 0 mismatches |
| `npm run credentials:check` | PASS |
| `git diff --check` | clean |
| U+FFFD scan (changed and new batch files) | clean |

Logs and evidence:

- `.tmp/unified-print/maintenance-batch-full-web-tests.log`
- `.tmp/unified-print/maintenance-batch-web-build.log`
- `.tmp/unified-print/maintenance-work-order-render-manifest.json`
- `.tmp/unified-print/maintenance-repair-order-render-manifest.json`
- `.tmp/unified-print/maintenance-repair-order-pdf-inspection.json`
- `.tmp/unified-print/maintenance-repair-order-layout-inspection.json`
- `docs/print/proofs/maintenance-{work-order,repair-order}-*`

## What is proven

- Both implemented documents render Arabic RTL and English LTR through the shared engine only.
- Both use a business number and business references; no CUID, UUID, token, raw foreign key, `lockVersion`, app chrome or action controls appear.
- Both re-read their canonical detail endpoint at print time and refuse to open a document when the read is denied.
- Both are read-only: no lifecycle, status, inventory, condition, warehouse, cost or production mutation.
- Empty optional sections are omitted rather than printed as placeholders; multipage output repeats table headers.
- The existing Maintenance Request route already used the shared engine and print-time re-read; a regression test now proves the re-read count and fresh payload.
- Tasks is correctly rejected because the persisted execution record has no business number and sourced executions are already covered by the request/work-order documents.

## Not verified (owner/manual)

- Native browser print preview, Save as PDF, print cancellation and physical paper output for the Work Order and Repair Order documents.
- Human visual review of the rendered PNG pages; this session inspected PDF text, bounds, collisions and page structure programmatically.
- Live canonical data: the API was not running (ports 3000/3001/4000 closed), so all document fixtures are explicitly labelled in-memory. No fixture was written to the database.
- Native browser automation was not available; no automated native screenshot or saved native PDF is claimed.

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

No commit, push, merge, reset, rebase, clean, branch or tag operation was performed. The working tree remains dirty with pre-existing print/report, employee-registration, mobile-login and production-closeout work. Files are classified for staging but not staged; unrelated user work was not modified or reverted.

## Dirty-tree classification (not staged)

Recorded at batch close: branch `main`, HEAD `54e3706f98c8ff7aa7f48febe12611015c3e29fe`, 54 modified files and 669 untracked files (590 of them PDF/PNG proof artifacts under `docs/print/proofs/`).

| Category | Scope | Files |
| --- | --- | --- |
| `PRINT_SHARED` | Shared engine, runtime, entry hook, test harness, print policy docs, print proof binaries, shared print tests | `apps/web/src/lib/print.ts`, `apps/web/src/components/print/{PrintDocument.tsx,print-runtime.tsx,use-print-document.ts,use-report-print-snapshot.ts}`, `apps/web/tests/{unified-print,unified-print-runtime}.test.ts`, `apps/web/tests/{jest.config.js,tsconfig.json}`, `apps/web/package.json` + `package-lock.json` (`react-test-renderer`), `apps/web/src/lib/i18n/locales/{ar,en}/common.ts` (`common.printedOn`), `docs/print/*`, `docs/print/proofs/*`, `docs/proofs/unified-print-*.md` |
| `PRINT_REPORTS` | Report pages, report adapters, report print tests, report i18n | `apps/web/src/app/admin/reports/**`, `apps/web/src/components/reports/ReportExportButton.tsx`, `apps/web/src/components/print/{inventory-*,maintenance-{assets,costs,downtime,kpis,low-stock,machine-log,machine-parts,overview,parts-usage,preventive,requests,schedules}-print,operations-print,system-*}.ts`, `apps/web/tests/{inventory-*,maintenance-*,operations-print,system-*}.test.ts`, `apps/web/src/lib/i18n/locales/{ar,en}/reports.ts`, `docs/proofs/unified-print-p0-maintenance-2026-11-12.md` |
| `PRINT_MAINTENANCE_OPERATIONAL` | Work Order / Repair Order / Request operational documents | `apps/web/src/app/admin/maintenance/{work-orders,repair-orders}/[id]/page.tsx`, `apps/web/src/app/admin/maintenance/requests/[id]/print/page.tsx`, `apps/web/src/components/print/maintenance-{work-order,repair-order,request}-document-print.ts`, `apps/web/tests/maintenance-{work-order,repair-order,request}-document-print.test.ts`, `apps/web/src/lib/admin-types/maintenance.ts`, `apps/web/src/lib/i18n/locales/{ar,en}/maintenance.ts`, `docs/proofs/maintenance-*-2026-11-12.md` |
| `EMPLOYEE_CREATE_UNRELATED` | Pre-existing employee-registration repair | `apps/api/src/common/i18n/api-messages.ts`, `apps/api/src/modules/admin/person-registrations/**`, `apps/web/src/app/admin/core/persons/page.tsx`, `apps/web/src/lib/person-registration-validation.ts`, `apps/web/src/components/f9/F9Lookup.tsx` (`required` marker), `apps/web/tests/person-registration*.test.ts`, `apps/web/src/lib/i18n/locales/{ar,en}/{core,validation}.ts`, `docs/proofs/employee-create-silent-save-repair-2026-11-10.md` |
| `MOBILE_LOGIN_UNRELATED` | Pre-existing LAN/mobile login repair | `apps/web/.env.example`, `apps/web/next.config.mjs`, `apps/web/src/lib/api.ts`, `apps/web/tests/mobile-lan-login.test.ts`, `docs/proofs/mobile-lan-login-repair-2026-11-10.md` |
| `PRODUCTION_UNRELATED` | Pre-existing production closeout evidence | `docs/proofs/production-release-operational-closeout-2026-11-10.md` |
| `TEMPORARY/GENERATED` | Session evidence only (ignored, not tracked) | `.tmp/unified-print/**`, local build output |

`apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/**` are unmodified. No category was staged, and no unrelated file was reverted.
