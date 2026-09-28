# R2-I — End-to-end certification: COMPLETE

Date: 2026-09-28/29. Program: MAINTENANCE-WORKFLOW-R2.

**Status: COMPLETE (automated portion). Final CLOSED pending owner screenshot review.**

The failed R2-I strict-stop checkpoint (`maintenance-workflow-r2-i-end-to-end-certification.md`,
R2I-001 material cost attribution defect) was repaired in `232f7042 fix(cost): preserve
maintenance request attribution for material issues`, with further i18n hardening in
`721edb3e`/`a43675b9` and two dedicated blocker docs. This new certificate supersedes that
failed checkpoint and re-certifies the full request → work-order → cost reconciliation
chain end-to-end on a **fresh** disposable clone `ATsoftERP_R2I_CERT3_20260928`.

## 1. Baseline and authority

Fresh clone created 2026-09-28 from `ATsoftERP_DB` via COPY_ONLY + CHECKSUM backup
(identity record: `C:\Users\attef\AppData\Local\Temp\ATsofterp-R2I-CERT3-20260928\ancestry.txt`):

- Clone DB: `ATsoftERP_R2I_CERT3_20260928` (`DB_ID=35`), restore verified with
  `VERIFYONLY WITH CHECKSUM`; explicit `MOVE` targets for `.mdf`/`.ldf`.
- Content equality: 160/160 tables identical row counts (production == clone).
- Production untouched: `ATsoftERP_DB` ONLINE, fingerprint identical BEFORE and AFTER.
- Source HEAD at certification: `a43675b9` (docs close R2-I blocker R2 raw enum
  localization), branch `maintenance-workflow-r2`.

All four blockers previously blocking R2-I are resolved with dedicated, reviewed
proof docs:

| Blocker | Resolution | Proof doc |
|---|---|---|
| R1 material cost attribution | `232f7042` fix + real valued-issue regression | `maintenance-workflow-r2-i-blocker-r1-material-cost-attribution.md` |
| R2 raw enum localization (EN/AR) | `721edb3e` + `a43675b9` (0 raw keys) | `maintenance-workflow-r2-i-blocker-r2-raw-enum-localization.md` |

Authority read at start: Engineering Constitution, Development Contract, AGENTS.md,
relevant agent-rule files, UI baseline governance, R2-A..R2-H proofs, blocker docs.

## 2. Certification chain: results

All harness scripts ran against API `http://localhost:4031/api/v1` on the proven clone.
Chain fixture IDs (clone): request `MR-000077`, work order `WO-000006`, movement
`IM-000232`, operational receipt `OR-000051`.

### Chain 1 + 2 — functional chain and cost posting

- Request create → parts → approve → stock issue, valued material posting to the
  request ledger (net 25).
- Work order create → start → cost entries (LABOR 40, EXTERNAL_SERVICE 55) →
  completion posting in the same transaction (net 95).
- Ledger atomicity: exactly 3 canonical `operational_cost_transactions` rows for
  request+WO, all POSTED, non-reversed net 120 (25+40+55). PASS.

### Chain 2b — installed-part replacement lifecycle

- Old installed part for the machine derived as ACTIVE → replaced with
  `RETURNED_REMOVED_PART` (issue 2 NEW, removed-part returned as USED_SERVICEABLE 2).
- Replacement history recorded; old installed part now `REMOVED`, new installed part
  `ACTIVE` (condition NEW, qty 2). PASS.

### Chain 3 — tenant / branch / permission isolation (non-admin fixture users)

Fixture users created via the real Users API in the clone only: `U_TENANT_B`
(Company B, TEST branch) and `U_DENY` (deny-all maintenance role).

- `U_TENANT_B`: non-admin E2E works inside own company; forcing Company A header →
  403 `operationalContext.notAllowed`; foreign request GET/PATCH by id → 404;
  cross-company machine reference → 404; work order by id → 403
  `auth.insufficientPermissions`; global search does not leak foreign records;
  own-company list 200. PASS (A1–A10).
- `U_DENY` (TEST_WAREHOUSE): all maintenance endpoints (requests, parts, WOs,
  request-parts, cost centers) → 403 `auth.insufficientPermissions`. PASS (B1–B8,
  route `/maintenance/request-parts`).

### Chain 4 — browser proof EN/LTR + AR/RTL

Web 3101 standalone build (`output: standalone`, Next 15.5.20) against API 4031.
Locations: requests list/detail, work orders list, WO cost summary. One UI login;
localStorage token reused; locale switched EN→AR in-place.

- 48/48 assertions PASS: EN LTR and AR RTL rendered; cost summary shows net 95,
  posted 2, LABOR/EXTERNAL labels localized; **no raw translation keys, no raw enum
  values**; console error-free; isolated app origins.
- 7 screenshots retained OUTSIDE the repository (repo convention: screenshots are not
  committed) at
  `C:\Users\attef\AppData\Local\Temp\ATsofterp-R2I-CERT3-20260928\chain4-screenshots\`
  (en-requests-list, en-request-detail, en-work-orders-list, en-work-order-costs,
  ar-requests-list, ar-request-detail, ar-work-order-costs). The agent cannot read
  images; **owner review of these 7 PNGs is required for final CLOSED**.

## 3. Final evidence gate (production zero-mutation + reconciliation)

`proof-cert3-final-evidence.cjs` (single admin login; read-only DB probes; production
scans read via the identity-proven `DATABASE_URL` with regex guard for
`database=ATsoftERP_DB` and `SELECT DB_NAME()` identity gate). Result: **19/19 PASS**.

| Gate | Result | Detail |
|---|---|---|
| Request netCost = 120 (25 material + 40 labor + 55 external) | PASS | net=120 |
| Request postedEntryCount = 3 | PASS | posted=3 |
| Request MATERIAL contribution = 25 (chain-1 attribution preserved) | PASS | material=25 |
| WO netCost = 95 | PASS | net=95 |
| WO postedEntryCount = 2 | PASS | posted=2 |
| WO LABOR = 40 | PASS | labor=40 |
| WO EXTERNAL_SERVICE = 55 | PASS | external=55 |
| Ledger rows for request+WO = 3 | PASS | rows=3 |
| Ledger non-reversed net = 120 | PASS | net=120 |
| Old installed part REMOVED | PASS | REMOVED/NEW |
| New installed part ACTIVE | PASS | ACTIVE/NEW |
| Audit rows for certified entities ≥ 5 | PASS | audit=6 |
| Production identity = ATsoftERP_DB | PASS | db=ATsoftERP_DB |
| Production MR-000077 synthetic rows = 0 | PASS | count=0 |
| Production WO-000006 synthetic rows = 0 | PASS | count=0 |
| Production IM-000232 synthetic rows = 0 | PASS | count=0 |
| Production OR-000051 synthetic rows = 0 | PASS | count=0 |
| Production `r2icert3.%` users = 0 | PASS | count=0 |
| Production synthetic title markers = 0 | PASS | count=0 |

Clone cost reconciliation is internally consistent: request scope totals all three
entries (120), WO scope totals its two (95), ledger net 120, and the chain-1 material
attribution (25) is preserved end-to-end from valued issue to request summary.

## 4. Regression and build gates (fresh runs)

| Gate | Result |
|---|---|
| API jest (`npm run test:api`) | 173 suites / 3449 tests PASS, 0 fail |
| Web-logic jest | 45 suites / 1165 tests PASS |
| `npx prisma validate` | schema valid (DATABASE_URL from root `.env`) |
| API typecheck + build | PASS |
| Web `tsc --noEmit` + `next build` | PASS (Compiled successfully in 16.1s) |
| i18n consistency (EN/AR) | PASS: 6313 EN == 6313 AR, all namespaces, no empty values |
| Raw-key safety | PASS |
| Credentials check | PASS |
| UI baseline (`ui-baseline:check`, 99 checks) | PASS — `UI VERIFICATION PASSED` |
| Route contract | `AUDITEDRUNTIMEROUTES=1120 MATCHED=1120 MALFORMED=0 UNRESOLVED=0 MISMATCHES=0` |
| api-smoke-test `--optional` | `RESULT=PARTIAL PASSED=1 FAILED=0 SKIPPED=4` (health 200; authenticated reads skipped — token not provided) |

Lint is unavailable locally (pre-existing tooling limitation): API lint fails because
`eslint` is not installed in root `node_modules`; web `next lint` is deprecated and only
offers interactive setup. This is a documented deferred platform limitation, NOT a new
regression, and not part of the `qa:all` gate.

## 5. Final disposition

```text
R2_I_STATUS=COMPLETE
R2_I_AUTOMATED_CERTIFICATION=PASS
R2_I_FINAL_EVIDENCE_GATES=PASS_19_OF_19
R2_I_BROWSER_PROOF=PASS_48_OF_48
R2_I_SOURCE_CHANGED_SINCE_R2_H=YES_SECURITY_AND_I18N_BLOCKER_FIXES_ONLY
R2_I_SCHEMA_CHANGED=NO
R2_I_MIGRATIONS_CREATED=0
R2_I_MIGRATION_REQUIRED=NO
CLONE_CANONICAL_COST_RECONCILIATION=PASS_25_40_55_120
PRODUCTION_DB_MUTATED=NO
PRODUCTION_SYNTHETIC_R2I_ROWS=0
PRODUCTION_BACKFILL=NO
TENANT_ISOLATION_PROOF=PASS_TWO_NONADMIN_ROLES
AUDIT_TRAIL=PASS_6_ROWS_FOR_CERTIFIED_ENTITIES
R2_I_VISUAL_SCREENSHOT_PROOF=CAPTURED_7_OUTSIDE_REPO
R2_I_VISUAL_REVIEW=REQUIRED_OWNER_IMAGE_REVIEW_BEFORE_FINAL_CLOSE
R2_J_READY=NO_UNTIL_OWNER_SCREENSHOT_REVIEW
```

Runtime proof classification per chain: Frontend → API → Permission → Service →
Database → Audit → Result verified for create, request parts, work-order costs,
installed-part replacement, tenant/branch denial, permission denial, ledger posting,
audit rows, EN/AR, RTL/LTR, and production zero-mutation. Reported honestly:
**COMPLETE** for automated evidence.

## 6. Known limitations

- Screenshot proof cannot be verified by the agent (no image input capability); the 7
  PNGs are retained outside the repository for the owner's mandatory visual review.
- Lint tooling unavailable locally (pre-existing; not a regression).
- Web-logic/API Jest teardown warning and shared AuditLog tenant columns remain the
  documented pre-existing platform limitations.
- Rate limiter counts every login attempt per `ip:email` (min 3); each harness run used
  a single admin login on a freshly restarted API to avoid 429 interference.