# Unified Issue Voucher — STRICT Phase 5 Final Closeout

Date: 2026-11-20
Repository: `ATsofterp`
Worktree: `.tmp/unified-issue-voucher-phase-5-release-worktree`
Branch: `main`
Feature commit: `c812021a9e9cf3847ab6f21aabfd6d445bf0f4f0`
Final runtime proof tag: `P5RUNTIME-20261120035032DD12`

## 1. Decision and status

STRICT Phase 5 is closed as `COMPLETE`. The unified `إذن صرف` / `Issue Voucher` experience is connected to real native authorities, real database records, real permissions, real stock postings, real reversals, real audit entries, and verified Arabic/English browser flows. Phase 6 was not started.

## 2. Entry baseline and isolation

The entry baseline was `origin/main == 7e1dc6d7d150f9ae5285c2025287c81b8c50f87a`; no Phase 5 work existed there. All implementation work was performed in the existing isolated worktree. The dirty shared tree, `fix/personnel-maintenance-integrity-r1`, personnel-maintenance files, other agents' untracked proofs, and temporary artifacts were not touched or staged.

## 3. Authority and reference order

The Engineering Constitution, relevant domain rules, Permanent Development Contract, UI/i18n baseline protection, and `AGENTS.md` were applied in the stated priority order. The inspection-pitfalls register was read before work and was updated with new runtime-proof findings.

## 4. Repository state recorded before work

Before the final closeout work the branch was `main`, HEAD and `origin/main` were both `c812021a9e9cf3847ab6f21aabfd6d445bf0f4f0`, and only `docs/governance/inspection-pitfalls-register.md` was modified. No user changes were overwritten.

## 5. Scope boundary and duplicate prevention

No unified issue table was created. Native spare-part requests/issues, `ProductionMaterialDocument`, and `FinishedGoodsIssue` were preserved unchanged in their ownership and lifecycle. The only additive authority is `GeneralInventoryIssue` for `PACKAGING_MATERIAL`, `CONSUMABLE`, and `GENERAL`.

## 6. Database models and migration

Migration `20261120160000_add_general_inventory_issue` adds the `general_inventory_issues` and `general_inventory_issue_lines` tables with tenant fields, issue classification, lifecycle metadata, movement linkage, reversal linkage, request-id idempotency, and scoped indexes. Applied migrations were not edited and no destructive reset or unverified `db push` was used.

## 7. Canonical type vocabulary

Canonical external values are exactly `SPARE_PART`, `RAW_MATERIAL`, `FINISHED_GOOD`, `PACKAGING_MATERIAL`, `CONSUMABLE`, and `GENERAL`. The canonical value is singular `FINISHED_GOOD`; legacy `FINISHED_GOODS` is accepted only as an input alias and normalized to `FINISHED_GOOD`.

## 8. Route and label identity

The canonical route is `/admin/inventory/issues`. User-facing labels are `إذن صرف` / `Issue Voucher` and `إذن صرف جديد` / `New Issue Voucher`. The legacy FG-only route `/admin/inventory/finished-goods-issues` remains compatible.

## 9. First and second field contract

The first dialog field is `نوع الصرف` / `Issue Type`; the second is `مستودع الصرف` / `Issue Warehouse`. Browser assertions verified the English first-field label and the Arabic first/second-field labels after selecting a general-family type.

## 10. Dependent candidate contract

Later candidate fields depend on `company`, `branch`, `issueType`, `warehouse`, and domain context. Backend lookup services enforce tenant, branch, permission, warehouse, order/run, location, batch, serial, and stock eligibility; the frontend does not send company or branch as authoritative filters.

## 11. Strict clearing contract

Changing issue type, warehouse, production order, production run, or operational context clears stale dependent state. Browser proof confirmed a confirmation dialog, type change to `GENERAL`, warehouse reset to the F9 prompt, zero item pickers, and zero quantity inputs after the change.

## 12. Native write routing

Writes are routed only to native endpoints: `SPARE_PART` to `/maintenance/requests/:id/parts` when linked, otherwise `/inventory/spare-part-issues`; `RAW_MATERIAL` to `/production/material-documents`; `FINISHED_GOOD` to `/inventory/finished-goods-issues`; and the three general types to `/inventory/general-issues`. The unified page performs read orchestration only.

## 13. General authority lifecycle

`GeneralInventoryIssue` uses `DRAFT`, `SUBMITTED`, `APPROVED`, `POSTED`, `REJECTED`, and `CANCELLED`, movement type `GENERAL_INVENTORY_ISSUE`, reversal movement `GENERAL_INVENTORY_ISSUE_REVERSAL`, and numbering prefix `GIS-`.

## 14. Permission model

One seeded authority `GeneralInventoryIssue` was added with stable `general-inventory-issue:*` keys. Existing native permissions continue to guard native families. No umbrella permission grants underlying write access, and the all-types warehouse F9 union includes only authorized issue families inside active tenant/branch scope.

## 15. Requester and warehouse approval separation

The requester submits; a different warehouse actor approves. Runtime proof recorded `submittedById=cmrl31v0g0004ok95wxhdi9lm` and `approvedById=cmtf71yxk0000vc95dd7a5upa`. Self-approval was rejected with `generalInventoryIssue.cannotApproveOwnRequest`.

## 16. Tenant, branch, and warehouse authorization

Every backend operation derives and validates the active company/branch context, scopes referenced warehouses and items, and rejects foreign references. A foreign-tenant warehouse returned `404 generalInventoryIssue.warehouseNotFound`; a tenant read returned `404 generalInventoryIssue.notFound`; a tenant reference returned `404 generalInventoryIssue.warehouseNotFound`.

## 17. Stock posting integrity

`post()` uses `where: { ..., status: 'APPROVED' }` and posts only through `InventoryMovementsService`. It never writes `InventoryBalance` directly. Runtime stock moved `100 -> 99 -> 100` with posted OUT movement `IM-000290` of type `GENERAL_INVENTORY_ISSUE`.

## 18. Reversal design

Reversal creates a separate compensating issue and movement; the original is never mutated. Reversal re-enters at the original immutable OUT cost through dedicated trusted valuation logic, so ACTIVE valuation warehouses do not misclassify it as generic inbound cost receipt. Final reversal was `GIS-000029` / `cmwofyu4r009oic95u12i4guz` with IN movement `IM-000292` and a localized note.

## 19. Valuation and costing

Atomic OUT quantities and original-cost reversal evidence are preserved in movement lines. No balance is edited without an authorized source document, and no same business amount is duplicated across hierarchy levels.

## 20. Audit evidence

`dbo.audit_logs` rows were captured for final general-family IDs. The 16 final rows include `CREATE`, `SUBMIT`, `APPROVE`, `POST`, `REVERSE`, `CANCEL_APPROVAL`, and `CANCEL`, with user IDs, company/branch details, issue numbers, movement numbers, old/new statuses, and reasons where required.

## 21. Numbering

Native numbering was preserved for `SPI-`, `PMD-`, and `FGI-` families. General issues used the new `GIS-` prefix: final run produced `GIS-000026`, `GIS-000027`, `GIS-000028`, and reversal `GIS-000029`.

## 22. Backend validation and error contracts

DTOs reject unknown fields, validate enums and required references, and return stable localized `messageKey` errors. Final negative assertions covered `productTypeMismatch`, `warehouseNotFound`, `locationNotFound`, `cannotApproveOwnRequest`, `notApproved`, `notDraft`, and `notFound`.

## 23. Frontend implementation

The dialog, form adapter, list panel, approvals panel, native action routing, admin navigation, permission catalogue, and EN/AR translation files are connected to the real API. Editing loads and patches the same native record; no fake buttons, static success responses, or mock operational data remain.

## 24. Arabic, English, RTL, and LTR

English LTR showed `Issue Voucher`, `New Issue Voucher`, and six localized type labels. Arabic RTL showed the Arabic page and six Arabic type labels. The filtered list and approvals inbox were checked in both locales, with no raw enum strings in the scoped UI.

## 25. Approvals inbox

`اعتمادات المستودع` displays type labels and a warehouse filter, and routes approve/reject/withdraw/cancel-approval actions to each native authority. Browser proof clicked the native approval action, confirmed it, and saw detail `status=APPROVED` with the separate approver ID.

## 26. Focused tests

Focused API tests passed: 5 suites / 213 tests. Focused web tests passed: 3 suites / 78 tests. Tests covered type selection, clearing, native routing, permissions, tenant isolation, P2034 retries with a real Prisma known-request error, posted immutability, double-post prevention, and reversal valuation.

## 27. Integration and API tests

Service and API tests exercised database-backed lifecycle transitions, invalid references, self-approval denial, status guards, audit writes, movement creation, and tenant/branch scoping. No failing assertion was skipped, weakened, or deleted.

## 28. Full regression

Full API regression passed: 238 suites / 5143 tests. Full web regression passed: 132 suites / 2486 tests. No new regression failure was introduced.

## 29. Prisma validation and generation

`prisma validate` and `prisma generate` passed. The schema and dated migration were checked for alignment before runtime use.

## 30. Type checking

API type checking passed. Web type checking passed.

## 31. Builds

API build passed. Web build passed.

## 32. i18n consistency

The i18n consistency check passed with 7572 English keys and 7572 Arabic keys synchronized. The raw-key check passed; known dynamic `t()` warnings remain pre-existing and were reported separately.

## 33. UI baseline integrity

`npm run ui-baseline:check` passed: 99 checks. The credential check passed without printing credentials.

## 34. Route-contract baseline

The route-contract checker remained at its pre-existing baseline: `MALFORMED=3`, `UNRESOLVED=3`, `MISMATCHES=0`, exit `1`. This was not a new Phase 5 failure.

## 35. Diff hygiene

`git diff --check` and `git diff --cached --check` were clean for feature and closeout content. New files use repository LF line endings; no generated, build, cache, log, secret, or temporary artifact was staged.

## 36. Migration deployment

The migration was applied on SQL Server 2016 with Windows-auth `sqlcmd -E -I` after the runtime user's DDL denial was confirmed. `MIGRATION_DDL_VERIFIED=1` covered 2 tables, 2 checks, 10 foreign keys, and 16+ indexes. `prisma migrate resolve --applied` and `prisma migrate status` succeeded cleanly.

## 37. Release build and package

The clean release was built at `C:\ATsoftERP\Releases\phase5-c812021a` and packaged as `C:\ATsoftERP\Releases\atsoft-erp-phase5-c812021a.zip` with SHA256 `d62f955f113a6d75581a3669654a8f2d882c13c1d980e991d5a50df9f78dd9a7`.

## 38. Deployment and services

The release was deployed to `C:\ATsoftERP\App\phase5-c812021a`; `C:\ATsoftERP\App\current` points there. App-level dependencies, Prisma schema/config, generated client, `msnodesqlv8`, and `sharp` were verified. Only `ATsoftERP_API` and `ATsoftERP_Web` were repointed; both services were `Running`.

## 39. Runtime health

Same-origin `http://localhost:3000/api/v1/health` returned `200 {"status":"ok","timestamp":"2026-11-20T03:20:52.319Z","uptime":1021.2942714}` and the web root returned `200`.

## 40. Final runtime proof identity

The final passing run was `RUNTIME_PROOF=PASS` with tag `P5RUNTIME-20261120035032DD12`. Evidence is in `C:\Users\attef\AppData\Local\Temp\opencode\phase5-runtime-proof.json`; the proof script is `phase5-runtime-proof.cjs` in the same temporary directory. Proof authentication used env-only JWTs; credentials remained `REDACTED`.

## 41. Lookups and candidate proof

All six warehouse/candidate/stock lookups returned `200`. Candidate counts were `SPARE_PART:2`, `RAW_MATERIAL:5`, `FINISHED_GOOD:20`, `PACKAGING_MATERIAL:2`, `CONSUMABLE:1`, and `GENERAL:1`.

## 42. Six native documents

The final run created all six native documents: `SPI-000007` (`cmwofypb9008qic95jgbq7svc`), `PMD-000041` (`cmwofypfp008vic959qtqu8z7`), `FGI-000012` (`cmwofypk30090ic95fbnrmh0c`), `GIS-000026` (`cmwofypo90095ic95xceb23b5`), `GIS-000027` (`cmwofyprk009aic95m36p1olk`), and `GIS-000028` (`cmwofypuq009fic95d7aqlrje`).

## 43. Unified authority proof

The unified list showed `SPARE_PART/SPARE_PART_ISSUE`, `RAW_MATERIAL/FLAT`, `FINISHED_GOOD/FLAT`, `PACKAGING_MATERIAL/GENERAL_INVENTORY_ISSUE`, `CONSUMABLE/GENERAL_INVENTORY_ISSUE`, and `GENERAL/GENERAL_INVENTORY_ISSUE`. The legacy `FINISHED_GOODS` filter returned the singular canonical `FINISHED_GOOD` row.

## 44. Browser EN/LTR and AR/RTL proof

English list direction was `ltr` with localized title and new action; Arabic list direction was `rtl` with localized title and new action. Filtered lists in both locales showed all six current references and no raw enum strings.

## 45. Strict clearing proof

The browser changed type to `GENERAL`, acknowledged the clearing confirmation, and verified that warehouse returned to the F9 prompt while item picker and quantity input counts became zero. No stale item, location, UOM, batch, serial, stock, or quantity survived.

## 46. Approvals and native action proof

General-family approval rows were visible with type labels and warehouse filter. The browser clicked and confirmed the native approval action; the detail showed `status=APPROVED` and `approvedById=cmtf71yxk0000vc95dd7a5upa`.

## 47. Posting, self-approval, and reversal proof

Self-approval was denied. Separate-actor approval and posting succeeded. Stock moved `100 -> 99 -> 100`. Movement `IM-000290` was `POSTED` with type `GENERAL_INVENTORY_ISSUE`; reversal `GIS-000029` posted IN movement `IM-000292` with localized note `Reversal of a posted issue voucher`.

## 48. Negative and mismatch proof

Ten expected negative outcomes were recorded: self-approval `400`, double-post `400`, posted immutability `400`, type mismatch `400`, foreign warehouse `404`, location mismatch `404`, batch mismatch `200` with zero matching rows, serial mismatch `200` with zero matching rows, tenant read `404`, and tenant reference `404`.

## 49. Telemetry classification

Eight console errors were exactly four `400` and four `404` resource messages tied to the expected denial paths. Eight HTTP error responses were the same expected denials. Ninety-six network failures were all `net::ERR_ABORTED`, caused by Next.js RSC/prefetch cancellation during rapid navigation; there were no non-aborted network failures.

## 50. Audit row evidence

Final audit IDs included `cmwofyprz009cic95baa37f9m` (`CREATE`), `cmwofytfy009iic954e7cw45a` (`SUBMIT`), `cmwofytpc009jic95mu42a6e7` (`APPROVE`), `cmwofytta009lic953c61zcxu` (`POST`), `cmwofyu53009qic95a5r14ury` (`REVERSE`), `cmwofyu7q009ric95na45phpy` (`SUBMIT`), `cmwofyua8009sic95oq7qil1z` (`APPROVE`), and `cmwofyucy009uic95vkxhzmqu` (`POST`), plus final cancel-approval/cancel rows for `GIS-000026` and `GIS-000028`.

## 51. Fixture cleanup and final disposition

All 13 stale non-POSTED `P5RUNTIME-` documents from aborted runs were cancelled through native endpoints; `GIS-000010` required `cancel-approval` before cancellation. The final list has zero non-POSTED proof documents. Six retained POSTED general issues each have a POSTED reversal with zero net stock effect. The temporary SUPER_ADMIN grant on user `cmtf71yxk0000vc95dd7a5upa`, role `cmrl31uxa0003ok95t4refsnp`, was deleted and verified absent; the proof approver token subsequently returned `403 operationalContext.notAllowed`.

Retained native proof fixtures are SPARE product `cmwoeoize0001ic956hls2nxi` / spare `cmwoepa4d0003ic95y1wxt97g`, CONSUMABLE product `cmwoepald000eic95evdjqsq3`, and GENERAL product `cmwoepay6000pic952nb2g2oq`, each created through native APIs with posted opening balance and zero net issue/reversal effect.

## 52. Known limitations and pre-existing issues

Historical retained reversals from aborted runs contain the literal note `inventory.issueVoucher.reverseNote`; this was a proof-script artifact, not feature behavior, and the final run stores localized text. Pre-existing warnings remain: dynamic `t()` key sites, missing translation warnings in some tests, Next.js multiple-lockfile warning, no ESLint config warning, and route-contract baseline exit `1`. Browser RSC abort telemetry is classified and not an application failure. No Phase 6 functionality was implemented or validated.

## 53. Final gate

All STRICT Phase 5 gates are evidenced: real database, backend, permissions, frontend, bilingual UI, tests, builds, deployment, runtime posting/reversal, audit, tenant isolation, cleanup, and privilege revocation. Inspection register entries P01–P41 were applied where relevant, and P36–P41 were added from this final proof.

PHASE 5 CLOSED — COMPLETE
PHASE_6_READY=YES
