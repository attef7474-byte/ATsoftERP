# Spare Part Expected Life — Phase 3 Final Closeout (2026-11-20)

## 1. FINAL DECISION
Phase 3 is `COMPLETE`. Canonical spare-part standard expected life and immutable automatic snapshot inheritance on every installed-part instance are implemented, migrated, deployed, tested, and proven in a real browser in Arabic/RTL and English/LTR. Phase 4 was not started.

## 2. SCOPE BOUNDARY
Phase 3 only. No unified Issue Voucher, receiving rebuild, global Excel program, `Product.quantity`, `Product.stock`, `SparePart.quantity`, second life system, alert redesign, or MTBF/MTTR redesign was introduced. Optional `تطبيق العمر القياسي` was decided not required and was not added.

## 3. ENTRY BASELINE
Entry branch was `main`; entry HEAD and `origin/main` were `88a99b24cec60266ff0781e533d62c3e1e74d862`; ahead/behind was `0/0`. Prerequisite governance was committed as `d1ce2e974d473e4c1402430b2cd8673abba805f9` on `feat/spare-part-life-phase-3` before implementation.

## 4. GOVERNANCE CHECKS APPLIED
`docs/governance/inspection-pitfalls-register.md` was read before work. Applied checks: P01, P05, P06, P09, P10, P11, P12, P13, P16, P17, P18, P19, P20. P19 was added for the installed-part reading timestamp mapping drift; P20 was added for env-only browser JWT authentication. The register is append-only and was updated only with evidence.

## 5. CANONICAL MODEL DECISION
Catalog default life lives only on `SparePart`. The applied per-installation snapshot lives only on `MachineInstalledPart`. The two values are distinct, shown separately, and never collapsed into one mutable field.

## 6. CATALOG FIELDS
Added nullable `defaultExpectedLifeValue` (`FLOAT`), `defaultExpectedLifeUnit` (`NVARCHAR(20)`), and `defaultWarningThresholdPercent` (`INT`). NULL is valid and means no standard life. No `defaultDueThresholdPercent` was added. Units are exactly `DAYS`, `HOURS`, `CYCLES`.

## 7. MIGRATION FILE
`apps/api/prisma/migrations/20261120150000_add_spare_part_default_expected_life/migration.sql` is additive, guarded, transactional, and non-backfilling. It adds the three columns and three check constraints. No applied migration was edited and no destructive SQL was used.

## 8. CLONE MIGRATION PROOF
The migration passed on disposable clone `ATsoftERP_EXCEL_20261117000316`. Column state moved `0 0 0 → 1 1 1`; three constraints were present; non-null legacy default life rows were `0`; migration history moved `0 → 1`; all reconciled row counts were unchanged. Evidence: `docs/proofs/spare-part-expected-life-phase3-migration-clone-proof-2026-11-20.md`.

## 9. PRODUCTION MIGRATION
Production database `ATsoftERP_DB` had verified backup `C:\Users\attef\AppData\Local\Temp\ATsofterp_pre_PHASE3_20261120_021828.bak`; `RESTORE VERIFYONLY ... WITH CHECKSUM` passed. DDL and history were verified with Windows integrated authentication. Evidence: `docs/proofs/spare-part-expected-life-phase3-production-migration-2026-11-20.md`.

## 10. DATA PRESERVATION
Production counts before and after migration were identical: products `128`, spare parts `406`, installed parts `3`, readings `0`, inventory movements `74`, movement lines `89`, balances `21`, replacement histories `0`. No historical row was backfilled and no existing value was changed.

## 11. CALCULATOR AUTHORITY
`computeExpectedLifeState(...)`, `DUE_PROGRESS_THRESHOLD = 0.9`, and the existing status model remain the single backend authority. No second calculator, status enum, or due threshold was created. Frontend displays backend-calculated values without recalculating them.

## 12. UNITS AND LABELS
English labels are exactly `Days`, `Operating Hours`, `Cycles`. Arabic labels are exactly `أيام`, `ساعات تشغيل`, `دورات`. No raw enum or raw translation key is exposed in the UI.

## 13. INHERITANCE BOUNDARY
All installation writers inherit through one canonical boundary: `recordInstalledPartInTx(...)`, using shared helper `buildInstalledPartLifeSnapshot(...)`. Manual registration, maintenance execution issue, direct issue/replacement, and future writers use the same snapshot logic.

## 14. SNAPSHOT IMMUTABILITY
The catalog HOURS value was changed from `8000` to `10000`. The first installed HOURS part remained applied `8000`; a new installed HOURS part inherited `10000`. Existing snapshots are never mutated by later catalog changes.

## 15. DAYS SEMANTICS
DAYS life uses `lifeStartDate`; wall-clock elapsed time is the only DAYS basis. Meter readings are rejected for DAYS-based life. No DAYS value is derived from operating hours.

## 16. HOURS AND CYCLES SEMANTICS
HOURS and CYCLES life uses `lifeStartReading`, `currentReading`, and expected life. Operating hours are never derived from wall-clock time. Reset uses an explicit meter-reading transaction.

## 17. STATUS MODEL
Preserved `UNKNOWN`, `NORMAL`, `WARNING`, `DUE`, `EXPIRED`. Browser proof observed `WARNING` at `80` percent and `NORMAL` in fresh states. No status was added, renamed, or hidden.

## 18. THRESHOLD MODEL
The catalog warning threshold defaults to `80` and is configurable `1–99`. DUE remains the centralized `0.9` progress threshold. No separate due-threshold field or constant was introduced.

## 19. READING HISTORY
Existing `POST` and `GET /installed-parts/:id/readings` endpoints were reused. Real readings are persisted; history remains complete and immutable. Decreasing readings are rejected rather than silently corrected.

## 20. RESET POLICY
Reset is explicit via `isReset` with notes. Audit records old reading, new reading, reset flag, notes, actor, and timestamp. The browser proof reset `2000 → 0` with notes `PHASE3_BROWSER_PROOF_RESET`.

## 21. OVERRIDE POLICY
Per-installation expected-life overrides remain supported through the existing endpoint. Snapshot fields copied at installation are preserved; an authorized explicit configuration may change the applied instance value with audit, but catalog edits never do so implicitly.

## 22. EXPLICIT CONFIGURATION
`PATCH /installed-parts/:id/expected-life` was reused for instance configuration. Catalog configure/update uses existing `POST /maintenance/spare-parts` and `PATCH /maintenance/spare-parts/:id` with paired value/unit/threshold fields.

## 23. INSTALLED-PART ENDPOINTS
Reused `POST /installed-parts`, `GET /installed-parts/:id`, `PATCH /installed-parts/:id/expected-life`, `POST /installed-parts/:id/readings`, `GET /installed-parts/:id/readings`, and `POST /installed-parts/evaluate-expected-life`. No redundant endpoint was added.

## 24. SPAREPART ENDPOINTS
SparePart catalog life fields are accepted by the existing create and update DTOs and normalized in `SparePartsService`. Cross-field validation enforces NULL consistency, positive value, canonical unit, and warning range.

## 25. PERMISSIONS
No new seeded permission key was created. Existing `installed-parts:read`, `installed-parts:create`, `installed-parts:update`, `machine:update`, `spare-part:create`, `spare-part:read`, and `spare-part:update` were reused. `MACHINE_UPDATE` was added only as a typed frontend constant; no permission catalogue entry changed.

## 26. AUDIT EVENTS
Existing actions were enriched: `INSTALLED_PART_REGISTERED`, `EXPECTED_LIFE_CONFIGURED`, `INSTALLED_PART_READING_RECORDED`, and SparePart `CREATE`/`UPDATE`. Browser proof directly verified three audit rows with full details, actor, and timestamp.

## 27. CATALOG FRONTEND
`apps/web/src/app/admin/maintenance/spare-parts/page.tsx`, `[id]/page.tsx`, and `[id]/edit/page.tsx` expose standard life, unit, and warning threshold through the real API on the same record. The list shows localized expected life.

## 28. INSTALLED-PART FRONTEND
`apps/web/src/app/admin/installed-parts/[id]/page.tsx` was extended with standard-vs-applied display, backend life status/progress, unit-adaptive configuration, reading entry, reset, and reading history. `data-testid` selectors were added for deterministic browser proof.

## 29. RELIABILITY FRONTEND
`apps/web/src/app/admin/maintenance/reliability/installed-parts/page.tsx` shows localized lifecycle state and drills through to the concrete installed-part instance. Existing MTBF/MTTR, alert, and analytics behavior was not redesigned.

## 30. SUPPORTING FRONTEND FILES
`apps/web/src/lib/maintenance/expected-life-display.ts`, web admin types, and EN/AR maintenance locales were added or extended. `apps/web/tests/spare-part-expected-life-phase3.test.ts` locks the frontend contract.

## 31. EXCEL SCOPE
Only the existing Spare Part master round-trip columns were extended with the three canonical catalog fields and unit enum. No installed-part reading import, global Excel program, or new authority was introduced.

## 32. INTEGRATION PRESERVATION
Maintenance execution and direct stock-issue replacement continue to call the same installed-part writer. Old instances are closed through existing removal/replacement logic; new instances receive snapshots through the single helper. No duplicate domain concept was created.

## 33. STOCK AND VALUATION SAFETY
No stock side effect was added. Browser-proof counts for `InventoryMovement`, `InventoryMovementLine`, `InventoryBalance`, product quantities, and replacement histories were identical before and after cleanup. Quantity sums were `1966550` and `547`.

## 34. TENANT AND BRANCH ISOLATION
Backend tenant/branch validation remains authoritative. Browser proof showed cross-tenant read `404`, write `404`, lookup search leak `false`. Existing service tests assert tenant scope and invalid-reference denial.

## 35. FOCUSED TESTS
Focused API: `phase3-default-life.spec.ts` `23/23` passed; combined installed-parts specs `66/66` passed. Focused web: `spare-part-expected-life-phase3.test.ts` `16/16` passed. The API spec includes a static regression guard locking schema/migration `createdAt` alignment.

## 36. FULL REGRESSION
Full API Jest after the final fix: `236` suites / `5045` tests / `0` failed. Full Web Jest after the final fix: `132` suites / `2460` tests / `0` failed. No test was skipped, deleted, weakened, or mocked away to obtain these results.

## 37. SCHEMA VALIDATION
`npx prisma validate --schema apps/api/prisma/schema.prisma` passed. `npx prisma generate` passed. A read-only database probe confirmed the reading model now uses the migrated `createdAt` column; no database DDL was required for the mapping fix.

## 38. TYPECHECKS AND BUILDS
API `npm run typecheck` and `npm run build` passed. Web `npm run typecheck` and `npm run build` passed with `199` static pages. Web BUILD_ID was `U-4jzO4R_WsGB_tMlQ4lA` and was present in served HTML.

## 39. GOVERNANCE VALIDATION
`npm run i18n:check` passed with `7489` EN/AR keys and `11672` literal `t()` keys resolved. `npm run ui-baseline:check` passed with `99` checks; raw-key and permission-UI checks passed. `git diff --check` passed.

## 40. ROUTE CONTRACT
`npm run route-contract:check` reported `MISMATCHES=0`, `MALFORMED=3`, `UNRESOLVED=3`, and exit `1`. This is the known pre-existing baseline and contains no Phase 3 finding.

## 41. DEPLOYMENT
Feature commit `ca74a7d08a2a4ebd1c001bc2658adc604f3687a8` was fast-forward merged and pushed to `main`. Runtime fix commit `ebc70e5eebe422f8983863bbcb033d9c40404ce0` was pushed to `origin/main`. Prisma client, API, and Web were rebuilt; NSSM services were restarted; Caddy was untouched.

## 42. HEALTH PROOF
After final deployment and restart: direct API `200`, `https://DELL/api/v1/health` `200`, and `https://DELL` `200`. All three Windows services were Running.

## 43. BROWSER PROOF
`PHASE3_BROWSER_PROOF=PASS`, `AUTH_MODE=ENV_DERIVED_JWT`, `SECRETS=REDACTED`, `SCREENSHOTS=12`. Evidence is `.tmp/phase3-browser-proof/evidence.json`; the full report is `docs/proofs/spare-part-expected-life-phase3-browser-proof-2026-11-20.md`.

## 44. RUNTIME ASSERTIONS
Browser proof verified inheritance values `5`, `8000`, `500`, catalog change `10000`, snapshot persistence `8000`, new instance `10000`, DAYS `WARNING` at `80`, reading rejection `400`, decreasing reading rejection `400`, history count `3`, reset `0`, EN `ltr`, AR `rtl`, tenant denial, permission denial, audit details, and zero console/page/5xx errors.

## 45. FINAL GIT STATE
Application source release SHA is `ebc70e5eebe422f8983863bbcb033d9c40404ce0`. This closeout and the browser-proof report are included in the proof-documentation commit. No tag was created. Final post-push verification showed `branch=main`, `HEAD=origin/main`, `ahead/behind=0/0`, and a clean working tree; the exact proof-commit SHA is reported in the final response.

## 46. KNOWN LIMITATIONS AND PRE-EXISTING ISSUES
Optional apply-standard action and advanced alert/MTBF/MTTR redesign are out of scope. Pre-existing observations: route-contract baseline exit `1`, global F9 `cost-snapshots` `500`, Jest worker teardown warning, `61` dynamic `t()` warnings, and no ESLint configuration. The reading `createdAt` mapping drift was a pre-existing defect fixed in Phase 3 with a regression guard.

## 47. CLOSEOUT
All Phase 3 requirements are implemented and proven end to end. Existing production data was preserved, tenant isolation held, stock remained untouched, both languages rendered correctly, and final builds/tests/health/browser checks passed. No Phase 4 scope was introduced.

PHASE 3 CLOSED — COMPLETE
PHASE_4_READY=YES
