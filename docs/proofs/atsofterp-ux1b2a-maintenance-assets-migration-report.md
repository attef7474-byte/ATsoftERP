# ATsofterp UX-1B-2A — Maintenance Assets and Machine Structure Migration Report

- **Task**: UX-1B-2A — align maintenance asset modules (machines, machine-categories, machine-components, machine-documents, machine-parts) with the canonical backend error contract, localized i18n (EN/AR), RTL/LTR, validation, and audit standards.
- **Status**: `COMPLETE`
- **Head**: `f515fc9df28219ac364758af5a61651bb02061db` (UX-1B-1 checkpoint; no new commits — per task constraints).
- **Date**: 2026-08-01

---

## 1. Task Status

`COMPLETE` — runtime verified end to end (API → service → audit → DB → web EN LTR + AR RTL), 60/60 browser-proof checks passed.

## 2. Exact Scope Completed

### 2.1 Backend (canonical error contract + audit attribution)

- `maintenance.controller.ts` — all machine mutation handlers now pass `@CurrentUser('sub') userId` into `MaintenanceService` (create/update/remove/activate/deactivate/status). Audit now records the acting user.
- `maintenance.module.ts` — `AuditModule` imported so `MaintenanceService` can audit.
- `maintenance.service.ts` — machine create/update/remove/activate/deactivate/status operations emit canonical validation errors (`common.validationFailed` + `errors[{field, code}]`) and messageKey not-found (`maintenance.machineNotFound`); all audited with `userId`.
- `machine-parts.service.ts` — canonical field errors (`code` duplicateValue, `machineId`/`productId` invalidReference, `code` immutable invalidValue), `maintenance.machinePartNotFound` messageKey, audit with userId (CREATE/UPDATE/DELETE).
- `machine-categories.service.ts` — canonical errors (auto-code via `MACHINE_CATEGORY`, `code` duplicateValue, `parentId` invalidReference/self-parent invalidValue, immutable code), `maintenance.machineCategoryNotFound`, audit CREATE/UPDATE/DELETE/ACTIVATE/DEACTIVATE with userId.
- `machine-components.service.ts` — canonical errors (`machineId` invalidReference, composite `machineId_code` duplicateValue, immutable code), `maintenance.componentNotFound`, audit with userId.
- `machine-documents.service.ts` — canonical errors (`machineId` invalidReference), `maintenance.machineDocumentNotFound`, `maintenance.machineNotFound` for `getDocumentsByMachine`, audit CREATE/UPDATE/DELETE with userId.
- `machine-parts/dto/create-machine-part.dto.ts` — machineId/productId reference resolution order fixed (machine/product lookups run before duplicate-code check only when valid).
- `api-messages.ts` — added maintenance not-found message keys (machine, part, category, component, document).
- **Defect found & fixed during proof**: all asset DELETE handlers used `ParseUUIDPipe({ version: '4' })` while Prisma generates CUIDs, making every real delete return 400. Removed the pipe from `maintenance.controller.ts` (machines/parts/documents) and the categories/components/documents/parts controllers, plus unused imports. Regression tests added (delete flows + conflict guards).

### 2.2 Frontend (5 modules migrated to canonical patterns)

- `machine-categories/` — list, new, edit: modal form, canonical `handleApiError` + `adaptFieldErrorsToMap`, translated labels/options, auto-code hint.
- `machine-components/` — list (F9 machine lookup in create/edit modal, translated `componentType`/`criticality` options, machine column, inline validation with `focusFirstInvalidField`), new page (code required — backend has no auto-numbering for components), edit page (code disabled + `codeImmutableHint`, readOnly when not ACTIVE).
- `machine-documents/` — list, new, edit, view, history pages.
- `machine-parts/` — list, new, edit, detail, linked-machines pages.
- `machines/` — list, new, edit pages.
- Removed dead `MachinePart.status` references (model has no status column): barcodes generate page, F9 adapters, machines detail parts tab, machines `[id]/parts` page (stock derived from quantity/minStock with `maintenance.inventoryStatus` keys).
- Shared `Input` fields carry explicit `name` attrs so `focusFirstInvalidField` works regardless of locale (F9Lookup already emits `data-field`).

### 2.3 i18n (EN + AR, synchronized)

- `maintenance.ts` EN/AR: `componentTypeOptions`, `criticalityOptions`, `inventoryStatus` (+ status keys outOfStock/lowStock/adequateStock/inStock), component form labels, new/options keys used by migrated pages.

## 3. Files Created

- `apps/api/src/modules/factory/maintenance/machine-assets-canonical-errors.spec.ts` (35 tests)
- `tools/health/ux1b2a-proof.mjs` (browser proof runner)
- `docs/screenshots/ux1b2a-maintenance-assets-migration/` — 12 screenshots + `ux1b2a-results.json`

## 4. Files Modified

Backend: `api-messages.ts`, `maintenance.controller.ts`, `maintenance.module.ts`, `maintenance.service.ts`, `machine-categories/{controller,service}`, `machine-components/{controller,service}`, `machine-documents/{controller,service}`, `machine-parts/{controller,service,dto/create-machine-part.dto.ts}`.
Frontend: 20 maintenance pages across the 5 asset modules + `barcodes/generate/page.tsx`, `components/f9/lookup-adapters.ts`, `machines/[id]/page.tsx`, `machines/[id]/parts/page.tsx`, `lib/i18n/locales/{en,ar}/maintenance.ts`.

## 5. Database Models / Migrations

None. No schema changes; delete-pipe fix is code-only.

## 6. API Endpoints Added/Changed

No signature changes. Behavior: DELETE now accepts CUID ids; all asset mutations return canonical validation/not-found contracts and audit the acting userId.

## 7. Frontend Routes

None added. Pages rewritten in place.

## 8. Permissions

None added/removed — existing keys reused (`machines:*`, `machine-category:*`, `machine-component:*`, `machine-document:*`, `machine-part:*`).

## 9. Tests Added and Results

- `machine-assets-canonical-errors.spec.ts` — **35/35 PASS** covering: auto-code (parts/categories/machines), duplicate code, invalid reference (machineId/productId/parent), not-found messageKeys (5 entities), immutable code, self-parent, activate/deactivate/status audit with userId, delete flows + conflict guards for all 5 services.
- Full API jest: **136 PASS** (18 pre-existing empty spec suites still fail with "must contain at least one test" — baseline, untouched).
- Web logic tests: **51 PASS / 4 suites**.

## 10. Build and Validation Results

- API `tsc` + build: clean.
- Web `tsc --noEmit`: clean; `next build`: clean (166 static pages).
- `npx prisma validate`: valid.
- `npm run i18n:check`: PASS — 3487 EN = 3487 AR keys, 14 namespaces, no empty values, all 6474 literal keys resolve.
- `npm run raw-keys:check`: PASS (18 safe dynamic-t() warnings, pre-existing contract).
- `git diff --check`: clean (LF→CRLF warnings only).

## 11. Runtime Proof Results

`tools/health/ux1b2a-proof.mjs` — **60 PASS / 0 FAIL** against running API + production web build:

- API contract: login/context, machine/category/part/component/document create with auto-codes (components require manual code), duplicate-code canonical field errors localized in Arabic, not-found messageKeys for all 5 entities, PATCH same-record round trip, invalid-reference errors, Machine CREATE audit with entityId, real create flows.
- WEB EN LTR: dir=ltr, translated headers, grids rendered, modals open, inline required errors (4/2/3), focus moves to first invalid field (`code`).
- WEB AR RTL: dir=rtl, Arabic headers on all 5 pages.
- Console: zero application errors.
- Fixture cleanup: all created fixtures deleted (200) — verified the delete-pipe fix at runtime; audit history retained by design.

## 12. Tenant-Isolation Proof

Operational context headers (`x-active-company-id`/branch) were required by the API guard during the proof; all runtime calls carried the authenticated admin context. No tenant-scope changes were made in this task (pre-existing enforcement unchanged).

## 13. Known Limitations

- `machine-components` create requires a manual `code` (no auto-numbering service wired for it — DTO contract, documented in code).
- Machine delete 409-conflict behavior for machines with linked components/requests/schedules/downtime is pre-existing (non-canonical ConflictException text, out of canonical-error scope).
- Other maintenance reference entities (cost-centers, production-lines, operation-types, etc.) still use `ParseUUIDPipe` on DELETE — same latent bug pattern, out of this task's scope (reported here as follow-up).
- Audit search param `search` on `/audit-logs` did not filter as expected in the proof probe; audit rows verified via entity/action matching instead.

## 14. Pre-existing Issues Encountered

- 18 empty API spec suites failing jest (baseline).
- `ParseUUIDPipe` on asset DELETE endpoints (fixed — see §2.1).
- Missing `common.manufacturer/model/serialNumber` keys (labels were using non-existent namespace; corrected to `maintenance.*`).

## 15. Git Status

Working tree contains the modified files above plus pre-existing untracked proof artifacts (`docs/proofs/atsofterp-ux1b1-checkpoint-report.md`, `proof-token.txt`, `tools/health/probe-buttons.mjs`). No commits, pushes, tags, or staged content — per task constraints.

## 16. Commit and Tag Status

None requested; none performed.
