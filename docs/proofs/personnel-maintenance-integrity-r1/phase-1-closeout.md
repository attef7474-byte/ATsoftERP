# Personnel and Maintenance Correction Program — Phase 1 closeout

Date: 2026-11-21 (Asia/Aden)
Status: **COMPLETE — Phase 1 only**
Phase 2: **NOT STARTED**

## 1. Scope completed

Four-word full-name validation, safe whitespace normalization, Yemen-only phone handling, canonical `+967` storage, normalized name/phone duplicate protection, maintenance capability label corrections, current-assignment list semantics, repeated transfer availability, and preserved assignment history. No Arabic-letter folding or carrier-prefix restrictions were added.

The normal registration UI uses OperationalPerson and its existing assignment, optional User and optional MaintenancePersonnel. Legacy employee/user/personnel writes use the same identity policy. A company-row SQL Server lock serializes the supported identity writers; comparisons use bounded 250-row pages to include noncanonical legacy values. Duplicate comparisons exclude the edited identity and remain company-scoped inside each separate authority. The same person may have a User and OperationalPerson with the same name/phone.

The generic assignment API returns effective current rows of all types; the main placement UI explicitly requests PRIMARY. Count and list use the same scoped predicate and half-open interval `effectiveFrom <= now < effectiveTo`, with null end meaning open. F9 retains non-primary current assignments. Person detail/history uses the dedicated history endpoint and displays all four rows after A → B → C → A. Transfers still close the old row, create the successor, and audit transactionally.

The legacy maintenance create alias requires existing `maintenance-personnel:create`, `operational-person:create` and `person-assignment:create`. Its registration action is hidden unless all three are granted, with explicit SUPER_ADMIN behavior preserved. A normal actor lacking person-create received 403 and created zero person rows.

## 2. Authoritative baseline and parallel-work preservation

- Baseline: `1fce7f1e2a00fe16200e27f0a1cadb1500048c2e`.
- Integrated branch: `fix/personnel-maintenance-integrity-r1-integrated`.
- Integration worktree: `C:/Users/attef/AppData/Local/Temp/ATsofterp-personnel-maintenance-p1`.
- Original workspace: `C:/Users/attef/PycharmProjects/Trae/ATsofterp`, branch `fix/personnel-maintenance-integrity-r1`, HEAD `7e1dc6d7d150f9ae5285c2025287c81b8c50f87a`.
- All 47 originally pending files remain byte-identical there: 43 Phase 1 files, two shared files and two other-agent proof files. The original workspace is intentionally still dirty; it was neither reset nor cleaned.
- The isolated integration began directly from the new baseline and carried the existing implementation forward. No history rewrite was used.
- The parallel program changed 40 upstream files. All 38 non-overlapping files remain byte-identical to upstream. Shared API messages contain only additive personnel keys; shared governance preserves the entire upstream P01–P41 text before the personnel append.
- Unified Issue Voucher, GeneralInventoryIssue/Line, inventory posting/reversal, native approval routing, Phase 5 permissions, item unification, reliability, useful-life and production authorities were preserved. No unrelated proof file was included in a Phase 1 commit.

See [ownership-proof.json](ownership-proof.json) for every original path, ownership classification and SHA256.

## 3. Files created (15)

- `apps/api/scripts/personnel-phase1-proof.cjs`
- `apps/api/src/common/operational-context/current-assignment-window.ts`
- `apps/api/src/common/validation/person-identity.spec.ts`
- `apps/api/src/common/validation/person-identity.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-personnel/maintenance-personnel.service.spec.ts`
- `apps/web/src/lib/person-identity.ts`
- `apps/web/tests/person-identity.test.ts`
- `apps/web/tests/person-registration-maintenance-permissions.test.ts`
- `docs/proofs/personnel-maintenance-integrity-r1/correction-register.md`
- `docs/proofs/personnel-maintenance-integrity-r1/favicon-baseline-proof.json`
- `docs/proofs/personnel-maintenance-integrity-r1/ownership-proof.json`
- `docs/proofs/personnel-maintenance-integrity-r1/runtime-api-proof.json`
- `docs/proofs/personnel-maintenance-integrity-r1/runtime-browser-proof.json`
- `docs/proofs/personnel-maintenance-integrity-r1/validation-results.json`
- `docs/proofs/personnel-maintenance-integrity-r1/phase-1-closeout.md`

## 4. Files modified (35)

- `apps/api/src/common/i18n/api-messages.ts`
- `apps/api/src/common/validation/validation-error-transformer.ts`
- `apps/api/src/modules/admin/employees/dto/create-employee.dto.ts`
- `apps/api/src/modules/admin/employees/employees.controller.ts`
- `apps/api/src/modules/admin/employees/employees.module.ts`
- `apps/api/src/modules/admin/employees/employees.service.spec.ts`
- `apps/api/src/modules/admin/employees/employees.service.ts`
- `apps/api/src/modules/admin/person-assignments/person-assignments.service.spec.ts`
- `apps/api/src/modules/admin/person-assignments/person-assignments.service.ts`
- `apps/api/src/modules/admin/person-registrations/dto/create-person-registration.dto.spec.ts`
- `apps/api/src/modules/admin/person-registrations/dto/create-person-registration.dto.ts`
- `apps/api/src/modules/admin/person-registrations/dto/update-person-registration.dto.ts`
- `apps/api/src/modules/admin/person-registrations/person-registrations.service.spec.ts`
- `apps/api/src/modules/admin/person-registrations/person-registrations.service.ts`
- `apps/api/src/modules/admin/users/dto/create-user.dto.ts`
- `apps/api/src/modules/admin/users/users.controller.ts`
- `apps/api/src/modules/admin/users/users.service.spec.ts`
- `apps/api/src/modules/admin/users/users.service.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-personnel/dto/create-maintenance-personnel.dto.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-personnel/maintenance-personnel.controller.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-personnel/maintenance-personnel.module.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-personnel/maintenance-personnel.service.ts`
- `apps/web/src/app/admin/access/users/page.tsx`
- `apps/web/src/app/admin/core/person-assignments/page.tsx`
- `apps/web/src/app/admin/core/persons/[id]/page.tsx`
- `apps/web/src/app/admin/core/persons/page.tsx`
- `apps/web/src/app/admin/maintenance/personnel/page.tsx`
- `apps/web/src/components/admin/ui/input.tsx`
- `apps/web/src/lib/i18n/locales/ar/core.ts`
- `apps/web/src/lib/i18n/locales/ar/validation.ts`
- `apps/web/src/lib/i18n/locales/en/core.ts`
- `apps/web/src/lib/i18n/locales/en/validation.ts`
- `apps/web/tests/person-registration-save.test.ts`
- `apps/web/tests/person-registrations-unified-page.behavior.test.ts`
- `docs/governance/inspection-pitfalls-register.md`

## 5. Database models and migrations

No Phase 1 schema, model, index, migration, backfill, merge, deletion or normalization rewrite was introduced. Existing dirty identity data is preserved. Preflight found 25 Users and 86 OperationalPeople; short names and malformed/duplicate legacy phone/name groups were documented in the correction register. An unconditional unique index over that data was intentionally not created.

The already-applied upstream migration `20261120160000_add_general_inventory_issue` remains intact. Prisma validate and generation passed against the reconciled schema. The disposable integrated clone contains that exact latest migration and both general-issue tables. No production migration was run in Phase 1.

Backup: verified COPY_ONLY/CHECKSUM backup `ATsofterp_personnel_P1_integrated_20261121.bak`. Proof target: `ATsoftERP_PERSONNEL_P1_INTEGRATED_20261121`. The script asserts `DB_NAME()` equals that clone before fixture writes. Source-database writes: **0**.

## 6. Existing API endpoints changed or exercised

No new API route was added.

| Existing endpoint | Phase 1 behavior |
| --- | --- |
| POST /person-registrations; PATCH /person-registrations/:id | Validate/normalize identity; scoped duplicate checks; separate login authority; keep canonical transaction/audit |
| POST /employees; PATCH /employees/:id | Same identity rules, duplicate policy and atomic identity audit |
| POST /users; PATCH /users/:id | Same User rules; no cross-table uniqueness; transactional role replacement and identity audit |
| GET /person-assignments | Effective current scope, shared count/list predicate, bounded pagination and branch-override denial |
| POST /person-assignments/:id/transfer/preview; POST /person-assignments/:id/transfer | Preserve current branch when optional DTO branchId is undefined; validate person reference in active scope |
| GET /person-assignments/person/:personId | Existing tenant/branch-scoped history authority retained and used by the detail UI |
| /maintenance/personnel list/detail/create/update/activate/deactivate/delete | Active context supplied; scope enforced; legacy create delegates to registration with required placement and all three create permissions; sensitive changes audited |

## 7. Frontend routes

No new frontend route was added. Existing routes updated: `/admin/core/persons`, `/admin/core/persons/[id]`, `/admin/core/person-assignments`, `/admin/access/users`, `/admin/maintenance/personnel`.

The existing Input gained an optional fixed prefix. Personnel controls show noneditable `+967` plus nine local ASCII digits and hydrate stored canonical numbers back to local digits on edit. New validation errors are localized. Labels are التخصص / Specialty and تمكين الدور / Enable role. The registration form now uses the existing `validation.required` key, removing its pre-existing missing-text fallback.

## 8. Permissions

No permission key, seed, role definition or production grant was added. Existing identity, assignment, user and maintenance keys remain authoritative. The legacy maintenance create guard now declares all three existing create permissions, matching its canonical delegation. Unit tests execute the real action-registration logic for missing-person-create, fully granted and SUPER_ADMIN principals. API proof uses normal scoped actors for allowed/denied operations; browser administration uses a disposable clone-only SUPER_ADMIN fixture.

## 9. Tests and regression

| Gate | Actual result |
| --- | --- |
| Focused API, including relevant Phase 5 paths | 12 suites / 328 tests passed |
| Focused web, including relevant Phase 5 paths | 10 suites / 205 tests passed |
| Full API | 240 suites / 5189 tests passed |
| Full web | 134 suites / 2513 tests passed |
| Newly added tests | 46 API + 27 web = 73 |

The four new test files cover identity rules/DTO bypass, legacy personnel scope/delegation, phone control rendering in both directions, and executed registration-action permissions. Existing service and page tests retain their business assertions with valid four-word fixtures. Transfer tests also cover an explicit undefined branch, scoped person references, current pagination and search. No test was skipped or weakened.

Full commands: `npx jest --config apps/api/jest.config.js --runInBand` and `npx jest --config apps/web/tests/jest.config.js --runInBand`. Focused command patterns and actual totals are preserved in [validation-results.json](validation-results.json).

## 10. Build and validation

- API TypeScript checking/build: PASS (`npm run typecheck --workspace apps/api`, `npm run build:api`).
- Web TypeScript checking/build: PASS; 199 pages generated. The final production build completed without the isolated-shell standalone-copy error.
- Prisma validate/generate: PASS; no Phase 1 schema change.
- EN/AR parity: 7,576 keys in each locale; all namespaces registered, no empty values.
- UI baseline, raw-key and permission-UI checks: PASS.
- Credential check after explicit staging: PASS.
- Unstaged and staged diff checks: PASS; P31 caught the sole new CRLF helper, which was normalized to LF without semantic changes or changes to the original workspace.
- Route contract: documented expected baseline, exit 1, MALFORMED=3 / UNRESOLVED=3 / MISMATCHES=0. The unresolved references remain the parallel inventory UI's existing dynamic-route findings.
- Pre-existing warning: no ESLint configuration detected. No claim of a separate ESLint pass is made.

Resolved proof-environment issues: development NODE_ENV in a production build, temporary-worktree relative upload root, and restricted-shell standalone symlink creation. They were resolved through process configuration/authorized build execution; no environment file or unrelated application module was changed.

## 11. Runtime proof

[API proof](runtime-api-proof.json): **21 checks passed**, run `1c3f21e0-5979-43ad-92e3-56f33243369c`.
[Browser proof](runtime-browser-proof.json): **28 checks passed**, run `be8a29ce-9f2a-44f7-b42e-bb8026abdc3a`.
Both are fresh PASS reports with start/finish timestamps and script SHA256 `84b28d6f81a22fc3330b8ad48d8f4cad8c987a0b757f7a191c3c840e9e4cf094`.

The real path `UI → API → authentication/permissions → service → SQL Server → audit → result` was exercised. Browser proof creates a four-word person through F9 placement selection, verifies canonical phone/database/audit, edits the same ID with prefilled local phone, verifies EN/LTR and AR/RTL validation/labels, rejects the missing-text fallback, observes one current assignment with Transfer Person still available after repeated transfers, displays all four history rows, and retains authorized maintenance registration access.

API proof additionally validates malformed phones, whitespace-normalized names, equivalent phone encodings, own-record edits, name/phone collisions on edits, separate User/OperationalPerson authorities, legacy employee/personnel writes, unknown-field rejection, one winner under simultaneous registration, and normal-role permission denial with no writes.

Required failed API responses in the browser: **0**. Unexpected JavaScript/console errors: **0**. The single known favicon console 404 is retained, not hidden.

## 12. Tenant isolation, data preservation and cleanup

Company B cannot read/edit Company A's person or personnel ID, cannot reference its person or department in a new transaction, and cannot find it through scoped search. Unauthorized branch context and missing create permission are denied. Separate companies may register their own identity with the same name/phone. Unit tests also assert the actual company/branch predicates rather than only mocking not-found results.

Both proof runs reconcile pre-existing User, OperationalPerson, OperationalPersonAssignment and AuditLog IDs in bounded 500-ID batches: **lost rows = 0**. No audit history was deleted. Inventory movements remain **125 → 125**. Transfer history retains four rows with one current successor, including exact transfer-boundary queries.

One interrupted browser-helper shutdown was cleaned using exact clone-only user/role pairs: one temporary elevated membership revoked, six fixture users deactivated, zero audit rows deleted. The corrected final proof completed cleanup: temporary SUPER_ADMIN memberships remaining **0**; all six final-run fixture actors deactivated. Fixtures/history remain only in the disposable clone for inspection.

## 13. Known limitations and verified pre-existing issues

- Exact unrelated request: `http://127.0.0.1:3320/favicon.ico`, initiated automatically by Chromium. The untouched deployed Phase 5 app independently returns 404 for `http://localhost:3000/favicon.ico`; origin/main has no favicon file or declaration. No Phase 1 favicon/layout change exists. See [favicon-baseline-proof.json](favicon-baseline-proof.json).
- Legacy short names, malformed phones and duplicate groups were not automatically repaired, merged or deleted. Validation applies to new or explicitly changed identity values. Legacy maintenance rows without authorized placement remain stored and excluded from scoped operational access until ownership is reconciled.
- Duplicate integrity for supported writers uses the shared SQL Server company lock and legacy-aware comparison, not a new unique index over dirty data. Direct external database writes remain outside the API contract.
- Browser screenshots and verbose logs are retained locally under ignored `test-results/`; no generated binaries, build caches, backups, secrets or temporary helpers were committed.
- This is feature-branch Phase 1 closure. Production deployment/merge and later maintenance corrections remain at their defined future phase boundaries.

## 14. Governance checks applied

Upstream P01–P41 remain intact. Relevant checks applied: P01, P02, P05, P09, P10, P12, P16, P17, P20, P22, P23, P31, P36, P37 and P41. Personnel findings PERSONNEL-P1-01 through PERSONNEL-P1-09 are appended, including explicit branch fallback, history-consumer compatibility, SQL parameter batching, favicon source classification, required-message localization, delegating-route permission ownership and fresh proof/cleanup integrity.

## 15. Git proof and repository state

Implementation commit: `2b24cae8f97444fa666036a9f4beabc5ebe9eeeb`.
Final code/security commit: `777def830621c40a098381ab1823c81ed0b9897c`.
That code SHA was pushed and verified equal locally and at `origin/fix/personnel-maintenance-integrity-r1-integrated`, ahead/behind **0/0**, with a clean integration worktree before this closeout document.

The docs-only closeout commit containing this file follows the verified code SHA. Final branch SHA/remote equality is checked again after pushing that document. `origin/main` remains at the stated Phase 5 baseline. Original workspace files and its dirty state are preserved; no reset, cleanup, force push, amendment, rebase or history rewrite was used. No tag was requested or created.

## 16. Phase boundary and continuation

```text
PERSON_NAME_VALIDATION=PASS
YEMEN_PHONE_VALIDATION=PASS
PERSON_DUPLICATE_PROTECTION=PASS
CURRENT_ASSIGNMENT_LIST=PASS
TRANSFER_HISTORY_PRESERVED=PASS
TRANSFER_ACTION_PRESERVED=PASS

PHASE 1 — COMPLETE
NEXT_PHASE_READY=YES
WAITING_FOR_USER_COMMAND:
انتقل لتنفيذ المرحلة التالية
```

Do not begin Phase 2 without that continuation command. The repository-backed correction register records all 28 program requirements and deferred authorities; the original complete program attachment path is recorded there for continuation without restating requirements.
