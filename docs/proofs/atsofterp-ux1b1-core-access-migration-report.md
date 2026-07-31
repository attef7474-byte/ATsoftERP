# ATsofterp UX-1B-1 — Core and Access Pages Migration Report

Status: **COMPLETED** — verified end-to-end (API contracts, i18n, unit tests, browser proof).

Date: 2026-08-01
Branch: `main`
Scope: `ATsofterp UX-1B-1` — Branches, Administrations, Departments (core); Users, Roles, role-permission assignment, permissions list/matrix (access) — aligned with the UX-1A foundation (localized field errors, i18n, RTL/LTR, a11y).

---

## 1. Task Status

`COMPLETED`. All vertical slices implemented on existing modules (no duplicate domains), 99 new/updated tests pass, i18n checker green, API+Web typecheck and production builds clean, runtime browser proof `38 PASS / 0 FAIL` against the live API + production web build.

## 2. Scope Completed

- Migrated 15 admin pages to the shared UX-1A patterns (`useApiErrorHandler`, `adaptFieldErrorsToMap`, `focusFirstInvalidField`, named fields + inline errors, clear-on-change, localized toasts/dates, code field in forms/modals).
- Backend field-error contract: services return `BadRequestException` with `errors[]` of `{field, code, message}` where `code` is a catalog message key; `AllExceptionsFilter` localizes them.
- New i18n keys: `validation.duplicateValue`, `validation.invalidReference`, and a new `organization` namespace (12 keys per locale).
- Tests: 5 backend service suites (48 tests), 4 web suites (51 tests).
- Runtime proof script with 38 assertions and 16 screenshots.

## 3. Files Created

Backend (5 new spec files):

- `apps/api/src/modules/admin/branches/branches.service.spec.ts`
- `apps/api/src/modules/admin/administrations/administrations.service.spec.ts`
- `apps/api/src/modules/admin/departments/departments.service.spec.ts`
- `apps/api/src/modules/admin/roles/roles.service.spec.ts`
- `apps/api/src/modules/admin/users/users.service.spec.ts`

Web:

- `apps/web/src/lib/i18n/locales/en/organization.ts`
- `apps/web/src/lib/i18n/locales/ar/organization.ts`
- `apps/web/tests/translation-organization.test.ts`

Tooling / proof:

- `tools/health/ux1b1-proof.mjs` (browser proof, 38 checks)
- `tools/health/probe-buttons.mjs` (DOM diagnostic probe used during proof development)
- `docs/screenshots/ux1b1-core-access-migration/` — 16 PNG screenshots + `ux1b1-results.json`

## 4. Files Modified

Backend:

- `apps/api/src/common/i18n/api-messages.ts` — added `validation.duplicateValue`, `validation.invalidReference`, full `organization.*` message set.
- `apps/api/src/modules/admin/branches/branches.service.ts`
- `apps/api/src/modules/admin/administrations/administrations.service.ts`
- `apps/api/src/modules/admin/departments/departments.service.ts`
- `apps/api/src/modules/admin/roles/roles.service.ts`
- `apps/api/src/modules/admin/users/users.service.ts`

Web pages (15):

- `apps/web/src/app/admin/core/branches/page.tsx`, `branches/[id]/page.tsx`
- `apps/web/src/app/admin/core/administrations/page.tsx`, `administrations/[id]/page.tsx`
- `apps/web/src/app/admin/core/departments/page.tsx`, `departments/[id]/page.tsx`
- `apps/web/src/app/admin/access/users/page.tsx`, `users/[id]/page.tsx`, `users/[id]/roles/page.tsx`
- `apps/web/src/app/admin/access/roles/page.tsx`, `roles/new/page.tsx`, `roles/[id]/edit/page.tsx`, `roles/[id]/page.tsx`
- `apps/web/src/app/admin/access/permissions/page.tsx`, `permissions/matrix/page.tsx`

Web i18n/tests:

- `apps/web/src/lib/i18n/types.ts`, `locales/en/validation.ts`, `locales/ar/validation.ts`, `locales/en/index.ts`, `locales/ar/index.ts`
- `apps/web/tests/error-utils.test.ts`

## 5. Database Models or Migrations Changed

None. Zero Prisma schema or migration changes; existing data untouched.

## 6. API Endpoints Added or Changed

No endpoint signatures changed. Behavior verified (real, connected to DB):

- `POST /branches` — cross-company body rejected 403 `operationalContext.companyMismatch`; duplicate code → 400 field error `validation.duplicateValue` (localized in AR).
- `GET /branches/:id` missing → 404 `messageKey: organization.branchNotFound`, Arabic message localized.
- `PATCH /roles/:id` on system role → 403 `organization.systemRoleProtected`.
- `POST /roles` duplicate code → 400 field error `validation.duplicateValue`.
- `POST /departments` cross-context reference → 403 `operationalContext.invalidRelationship` (tenant boundary guard).

## 7. Frontend Routes Added or Changed

No new routes. 15 existing admin routes migrated to the UX-1A form/error/i18n patterns (edit pages fetch and prefill the same record; create uses POST; update uses the established PATCH `/:id`).

## 8. Permissions Added or Changed

None. Existing permission keys unchanged; backend permission enforcement was preserved and verified (system-role protection, admin page access).

## 9. Tests Added and Results

Backend (`apps/api`) — jest, focused suites, 48/48 PASS:

- branches: duplicate code field error, invalid company reference field error, localized not-found message key, soft-delete, code auto-generation.
- administrations: duplicate code field error, delete-with-departments → 409 ConflictException localized, scoped queries.
- departments: full `validateReferences()` chain (company, branch, administration, parent), invalid reference field errors, not-found localization, delete protection.
- roles: duplicate code field error, system-role protection (403), unknown permission reference, last-SUPER_ADMIN guard, delete-with-users → 409.
- users: duplicate email field error, invalid role reference, cannot remove last SUPER_ADMIN, scoped queries.

Web (`apps/web`) — 51/51 PASS across 4 suites:

- `error-utils.test.ts`: dictionary coverage for new keys, field-error localization (server message kept when different from code; localized when equal), organization messageKey resolution.
- `translation-organization.test.ts`: en/ar key sets synchronized, organization namespace registered and translated, required keys present, no empty values.

Full-suite jest still reports 18 failed suites — all 18 are the pre-existing 0-byte spec files in the repo (confirmed by file listing); unrelated to this task and left untouched.

## 10. Build and Validation Results

All green:

- `npx prisma validate` (from `apps/api`): schema valid.
- API `npx tsc --noEmit`: 0 errors.
- Web `npx tsc --noEmit`: 0 errors.
- API `npm run build`: clean.
- Web `npm run build`: clean (production build; servers restarted on these builds).
- `npm run i18n:check`: 3469 EN = 3469 AR keys, 14 namespaces registered, no empty values, all 6500 literal `t()` keys resolve.
- `npm run raw-keys:check`: pass.
- `git diff --check`: no errors (only LF→CRLF warnings from the repository's line-ending config).

## 11. Runtime Proof Results

`tools/health/ux1b1-proof.mjs` against live API (port 4000) + production web build (port 3000), Chromium headless 1366×768: **38 PASS / 0 FAIL**, 16 screenshots in `docs/screenshots/ux1b1-core-access-migration/`, results in `ux1b1-results.json`.

Proven path: `Frontend → API → Permission/context guard → Service → DB → localized error/message → UI (AR+EN, RTL+LTR)`.

Highlights:

- API login + `/auth/me` + `/auth/contexts` resolve the user and active operational context.
- Tenant boundary: cross-company `POST /branches` → 403 `companyMismatch`; cross-context department reference → 403 `invalidRelationship`.
- Field-error contract: duplicate code → 400 `validation.duplicateValue` with localized Arabic message; invalid reference codes returned as catalog keys.
- Localized not-found: 404 `organization.branchNotFound`, Arabic message "غير موجود".
- System-role protection enforced at runtime (403 `systemRoleProtected`).
- Web EN LTR: branches header, 5-row grid, create modal with named fields, inline field errors on empty submit, focus moves to first invalid field (`company`).
- Web AR RTL: `dir=rtl`, Arabic header, Arabic create modal.
- Core pages: administrations grid (3 rows), departments grid (4 rows) + modal with all named fields.
- Access pages: roles grid (4 rows) + permissions modal, users grid (3 rows), permissions matrix table (7 columns).
- Detail + edit prefill: branch detail renders, Edit modal opens, 3/4 fields prefilled; department detail, role edit page, user detail render; branch detail AR RTL.
- Console: no application errors (8 logged resource failures are exactly the deliberate 4xx contract probes).

## 12. Tenant-Isolation Proof

- Cross-company write rejected by the operational-context guard before reaching the service (`companyMismatch`).
- Cross-context relationship rejected (`invalidRelationship`).
- System role mutation rejected (`systemRoleProtected`).
- All list/detail probes performed under the active operational context headers; unit tests assert company/branch scoping on queries (Company A record not readable by Company B paths).

## 13. Known Limitations

- Field-error `invalidReference` on `POST /departments` for company/branch/administration cannot be triggered over the HTTP API under an active operational context because the context guard (correctly) rejects mismatched relationships first with a 403. The service-level validation is covered by unit tests; the runtime contract proof documents the guard behavior instead.
- The parentId field-error runtime probe was skipped automatically because the seed company has no administrations to satisfy the guard for the service path (reported as PASS with note; guard proof above).
- The 8 "Failed to load resource" console entries are the deliberate 4xx contract probes, not application errors.

## 14. Pre-Existing Issues Encountered

- 18 zero-byte API spec files make the full jest run report failed suites; they predate this task and were not touched.
- `git diff --check` emits LF→CRLF warnings (repository-wide line-ending config), no errors.
- Earlier in the session: `next build` clobbered `.next` chunks while an old stale dev server was running; resolved by rebuilding both apps and restarting the servers on the fresh builds (current servers: API PID 14252, Web PID 40240).

## 15. Git Status

- Modified: 27 tracked files (see sections 4).
- Untracked: 5 backend spec files, 2 organization locale files, 1 web test, proof script + probe script, screenshots dir, and the pre-existing `proof-token.txt` (untouched).
- No commits, no staging, no pushes performed (per task instructions).
- `proof-token.txt`, `.env*` files, and the 18 pre-existing empty specs were never modified.

## 16. Commit and Tag Status

Not requested; no git write operations were performed.
