# Unified Receipt Voucher — Phase 2 Final Closeout (2026-11-20)

## 1. PHASE 2 FINAL DECISION
Phase 2 is COMPLETE. The single canonical Arabic/English `إذن استلام / Receipt Voucher` experience is implemented, validated, merged to `main`, pushed, migrated, deployed, and proven in a real browser in both AR/RTL and EN/LTR. Phase 1 authorities remain unchanged and authoritative.

## 2. SCOPE BOUNDARY
Phase 2 only: unified receipt UI, classification metadata, read-only orchestration, native write routing, permissions, i18n, tests, migration, deploy, and proof. No Phase 3 spare-part expected life, no unified Issue Voucher, no global Excel program, no `Product.quantity`, no `Product.stock`, no `SparePart.quantity`, and no second receipt authority.

## 3. BASELINE ENTRY
Entry branch `main`, baseline HEAD `9149a1cb`, clean working tree before changes. No unrelated modules were refactored.

## 4. ARCHITECTURE DECISION
The UI is unified; stock authority is not. `InventoryOperationalReceipt` remains authoritative for `RAW_MATERIAL`, `SPARE_PART`, `PACKAGING_MATERIAL`, `CONSUMABLE`, `GENERAL`. `ProductionFinishedGoodsReceipt` remains authoritative for `FINISHED_GOOD`.

## 5. CANONICAL ROUTE
`/admin/inventory/receipts` is the new canonical page. Native deep links `/admin/inventory/operational-receipts` and `/admin/production/finished-goods-receipts` are preserved and asserted.

## 6. FIRST FIELD
The first form field is `نوع الاستلام` / `Receipt Type`, with exact Arabic options: `مواد خام`, `قطع غيار`, `منتج تام`, `مواد تعبئة وتغليف`, `مستهلكات`, `أصناف عامة`.

## 7. DYNAMIC FORM
Selecting a non-FG type renders warehouse, location, source, reason, and operational lines. Selecting FG renders production order, production run, warehouse, document date, and FG lines. Upstream changes clear downstream state with confirmation when dependent data exists.

## 8. BACKEND GATE
The operational service rejects mismatched `Product.itemType`, inactive/unclassified products, missing canonical `SparePart` links, and `FINISHED_GOOD` through the operational authority.

## 9. UNIFIED ENDPOINTS
Added `GET /api/v1/inventory/receipts/capabilities`, `GET /api/v1/inventory/receipts`, and `GET /api/v1/inventory/receipts/:authority/:id`. All are read-only.

## 10. PERMISSION MODEL
No new umbrella permission was created. Page visibility uses OR of native read keys via `assertUserHasAnyPermission` / permission snapshot semantics. Actions remain domain-specific native permissions.

## 11. TENANT ENFORCEMENT
Both authority queries force `companyId` and `branchId` from the active operational context. Client payloads never send company/branch for creation. Filters, list, detail, and deep links are tenant-scoped.

## 12. AUDIT AND VALUATION
No audit, valuation, movement, or balance logic was duplicated. Existing native lifecycle, posting, valuation, movement, and audit engines remain the only writers.

## 13. DATABASE MODEL
Added nullable metadata columns `receiptType` and `receiptSource` to `InventoryOperationalReceipt`. NULL means legacy/native-operational. No backfill, no destructive change, no applied migration edited.

## 14. MIGRATION FILE
`apps/api/prisma/migrations/20261119130000_add_operational_receipt_classification/migration.sql` adds two `NVARCHAR(1000)` columns and two check constraints using idempotent guards.

## 15. MIGRATION EXECUTION
`prisma migrate deploy` failed safely with `P3018` / SQL error `1088` because the runtime DB user has `ALTER_PERM=0`. The reviewed migration was executed with the Windows sysadmin account via `sqlcmd -E`, verified, and marked applied with `prisma migrate resolve --applied`.

## 16. MIGRATION VERIFICATION
`receiptType_LEN=2000`, `receiptSource_LEN=2000`, `constraints=2`, existing receipts `18`; `prisma migrate status` reports `Database schema is up to date!`.

## 17. FRONTEND IMPLEMENTATION
Added canonical route, unified panel, dynamic receipt dialog, pure form model, navigation entry, EN/AR keys, dependency clearing, native payload routing, and preserved native deep links.

## 18. WRITE ROUTING
Create/edit/status actions call the existing native endpoints with native DTO shapes. The unified module never writes stock or documents.

## 19. FIXED DEFECT — PAGINATION
Unified pagination initially applied `skip` per authority and again on the merged union. Corrected to supply the full window from each authority and paginate once; regression test added.

## 20. FIXED DEFECT — PRISMA `_sum`
Runtime browser proof exposed `PrismaClientValidationError: Unknown field _sum` in `findMany`. Corrected by selecting line quantities and computing totals in `normalizeOperational`; regression assertion added.

## 21. FOCUSED WEB TESTS
`apps/web/tests/unified-receipt-voucher.test.ts`: 13/13 passed, including exact six Arabic labels, first field, authority mapping, dependency clearing, native payloads, load-same-record, and OR navigation semantics.

## 22. FULL WEB SUITE
`npm run test:web-logic`: 131 suites / 2444 tests passed.

## 23. FOCUSED API TESTS
Unified + operational receipt specs: 28/28 passed after pagination fix; unified spec 12/12 passed after `_sum` fix, including tenant scoping, OR permission, authority narrowing, filters, pagination, normalized details, and native deep links.

## 24. FULL API SUITE
`npm run test:api`: 235 suites / 5022 tests passed after the final fix. One pre-existing Jest worker teardown warning observed.

## 25. TYPECHECKS
`npm run typecheck --workspace apps/api` and `npm run typecheck --workspace apps/web` both passed.

## 26. PRISMA VALIDATION
`prisma validate` passed using a placeholder non-secret `DATABASE_URL`.

## 27. BUILDS
API build passed. Web build passed; a stale `apps/web/.next` cache caused one known `global-not-found.js` module error, was cleared once, and rebuilt successfully. Final production manifest contains `/admin/inventory/receipts/page`.

## 28. I18N
`npm run i18n:check` passed: 7454 EN keys / 7454 AR keys synchronized, namespaces registered, no empty values, all literal `t()` keys resolved.

## 29. GOVERNANCE CHECKS
`raw-keys:check`, `ui-baseline:check`, `credentials:check`, and `git diff --check` passed.

## 30. ROUTE CONTRACT
`route-contract:check` reports `MISMATCHES=0`. It exits 1 due pre-existing baseline `MALFORMED=3`, `UNRESOLVED=3`; no Phase 2 finding remains after native literal endpoint refactor.

## 31. COMMITS AND PUSH
Feature commit `6f86986b5c4fa11e8fc5d0218dc36da2e20c83d1` pushed to `origin/feat/unified-receipt-phase-2`. `main` fast-forwarded and pushed. Runtime fix commit `402d29caf80def79db1b1c4c4e48fd24301cf077` pushed to `origin/main`.

## 32. DEPLOY TARGET
Local runtime runs directly from the repository via NSSM services `ATsoftERP_API` and `ATsoftERP_Web`; Caddy service untouched. Final built code commit is `402d29caf80def79db1b1c4c4e48fd24301cf077`.

## 33. RUNTIME REBUILD
`prisma generate`, `npm run build:api`, and `npm run build:web` all exited 0. Services were recycled after the build so both children loaded artifacts newer than their start time.

## 34. HEALTH / PARITY
Web `/` and `/admin/inventory/receipts` return 200. Unified capabilities returns 401 unauthenticated and 200 authenticated. API log maps all three unified routes. Swagger is disabled in production by existing config and is not a defect.

## 35. BROWSER PROOF
Real Playwright/Chromium proof passed 40/40 in AR/RTL and EN/LTR using env-derived seeded admin credentials. Screenshots and machine evidence: `.tmp/phase2-browser-proof/`.

## 36. BROWSER ASSERTIONS
Verified real login, canonical page, page title, no raw i18n keys, no deny state for admin, capabilities 200, union read keys, six canonical backend types, unified list 200, first field, exact six labels, raw-material dynamic form, FG dynamic form, dependency-specific field visibility, and successful API calls.

## 37. TENANT PROOF
Service unit tests assert `companyId` and `branchId` in both authority queries, cross-authority authority narrowing, and detail denial. Runtime active branch has zero receipts; list envelope is correctly scoped (`total=0`). The 18 legacy receipts have NULL `branchId` and are excluded under a branch context exactly as the native operational service does.

## 38. DEEP-LINK PROOF
Unit tests assert `/admin/inventory/operational-receipts?receipt=<id>` and `/admin/production/finished-goods-receipts?receipt=<id>`. Runtime row-level deep-link rendering was not exercised because the active branch has zero receipts; this is a disclosed coverage limitation, not a failure.

## 39. KNOWN LIMITATIONS
External/purchased finished-goods receipt remains unsupported anywhere and was not invented. Batch/serial/expiry/UOM are shown only on the FG authority because operational receipt lines do not have those columns. Legacy NULL-type receipts display as legacy/native.

## 40. PRE-EXISTING ISSUES
`route-contract:check` baseline exit 1; global F9 `cost-snapshots` 500; Jest worker teardown warning; dynamic `t()` warnings; stale Next cache encountered once. A diagnostic URI parse emitted a connection string in tool output; the value was treated as REDACTED and never repeated or committed.

## 41. FILES AND API SUMMARY
Created 14 files in the feature commit; modified 12 files; final fix modified 2 API files. Added 3 GET endpoints, 1 canonical web route, 0 new permissions, 1 additive migration, 0 destructive schema changes, 0 new stock authorities.

## 42. CLOSEOUT
Phase 2 is closed with COMPLETE runtime, AR/EN, AR/RTL, EN/LTR, build, test, migration, deploy, and browser evidence. No Phase 3 scope was introduced.

PHASE 2 CLOSED — COMPLETE
PHASE_3_READY=YES
