# Testing and Proof Rules

## 1. Focused-First Validation

For every implementation task:

1. Inspect changed files.
2. Run focused unit tests.
3. Run focused integration/API tests.
4. Run Prisma validation when schema-related.
5. Run Prisma generation when required.
6. Run API type checking or build.
7. Run Web type checking.
8. Run Web build.
9. Run i18n consistency check.
10. Run focused browser proof for critical workflows.
11. Inspect `git diff --check`.
12. Inspect final `git status`.

Run the full build when the coherent implementation batch is ready — not after every small edit.

## 2. Required Test Categories

* Business-rule unit tests.
* Service/database integration tests.
* API authorization tests.
* Tenant-isolation tests.
* Permission allow/deny tests.
* Status-transition tests.
* Inventory atomicity tests.
* Duplicate-submission tests.
* Invalid-reference tests.
* Regression tests for fixed defects.
* Frontend interaction or browser tests for critical workflows.

Empty test files do not count. Do not delete, skip, weaken, or mock away failing business-rule tests. Do not disable validation or tests to make a build pass.

## 3. Tenant-Isolation Matrix

For tenant-owned entities, test at minimum:

* Company A can access its record.
* Company B cannot read it by ID.
* Company B cannot edit it by ID.
* Company B cannot reference it in a new transaction.
* Unauthorized branch access is rejected.
* Search and export do not leak the record.

## 4. Migration Validation

For schema changes, prove:

* Existing-data impact and backfill behavior.
* Phased migration applied safely.
* Existing rows preserved and verified (counts and samples).
* Rollback or recovery approach documented.
* Index and tenant impact documented.

## 5. Create/Edit/Status Proof

For a critical workflow, prove the real path:

`Frontend → API → Permission → Service → Database → Audit → Result`

Verify where applicable: create, read, edit the same record, status transition, permission denial, tenant denial, inventory effect, cost effect, audit event, Arabic UI, English UI, error handling, duplicate prevention.

## 6. Inventory and Cost Atomicity Proof

* Posting a movement updates the balance in the same transaction.
* Installation/replacement updates parts, movements, and balances atomically.
* No negative balance is possible through any supported flow.
* No duplicate movement posting is possible (idempotency).
* Show actual test results, not "tests appear fine".

## 7. Arabic and English Proof

* Both locales load without missing keys.
* Arabic pages render RTL; English pages render LTR.
* New keys exist in both locale files; key sets remain synchronized (i18n consistency check).
* No raw translation keys or hard-coded English/Arabic in UI.

## 8. Build and Typecheck

* API type check/build passes.
* Web type check/build passes (pages generated count expected).
* `git diff --check` clean (no whitespace errors).

## 9. i18n Verification

Run the i18n consistency check and report the exact EN/AR key counts and match percentage.

## 10. Final Diff and Git Status

* Inspect the final diff for scope leaks: no unrelated files, no secrets, no generated artifacts.
* Report final `git status` honestly.
* Do not claim a clean tree when task-created proof files are present.

## 11. Honest Status Reporting

Use one of:

* `COMPLETE` — full vertical slice verified with evidence.
* `PARTIAL` — implemented but not fully verified.
* `BLOCKED` — cannot proceed without resolving an obstacle.
* `NOT_VERIFIED` — implemented but runtime wiring not verified.

Never report `COMPLETE` when runtime wiring was not verified. Never claim "production ready" without evidence.
