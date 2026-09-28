# R2-I — End-to-end certification: CLOSED

Date: 2026-09-28/29. Program: MAINTENANCE-WORKFLOW-R2.

**Status: CLOSED. R2-J readiness: YES (owner visual review completed, no blocking defect).**

The failed R2-I strict-stop checkpoint (`maintenance-workflow-r2-i-end-to-end-certification.md`,
R2I-001 material cost attribution defect) was repaired in `232f7042 fix(cost): preserve
maintenance request attribution for material issues`, with further i18n hardening in
`721edb3e`/`a43675b9` and two dedicated blocker docs. This new certificate supersedes that
failed checkpoint and re-certifies the full request → work-order → cost reconciliation
chain end-to-end on a **fresh** disposable clone `ATsoftERP_R2I_CERT3_20260928`.

**Owner visual review (2026-09-29):** the seven chain-4 screenshots (EN-LTR requests
list/detail, work-orders list, WO cost summary; AR-RTL equivalents) were reviewed by the
owner and found compliant with the required R2-I visual criteria — verdict PASS. R2-I is
therefore fully CLOSED. (The executing agent cannot perform pixel inspection itself; the
seven retained screenshots were subsequently reviewed by the owner/image-capable reviewer
and passed — valid actual visual review, not DOM-only substitution.)

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
  images; the owner has since reviewed all 7 PNGs and reported **no blocking visual
  defect** (owner statement 2026-09-29).

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

### 5.1 Owner visual-review closeout (2026-09-29)

The seven retained R2-I screenshots (ar-work-order-costs.png, en-request-detail.png,
en-requests-list.png, en-work-order-costs.png, en-work-orders-list.png, ar-request-detail.png,
ar-requests-list.png) were reviewed by the owner/image-capable reviewer. The executing agent
could not perform pixel inspection itself (no image input capability), but these seven
retained screenshots were subsequently reviewed by the owner and passed the required R2-I
visual criteria. This is valid actual visual review, not DOM-only substitution.

| Visual finding | Owner verdict |
|---|---|
| EN / LTR direction | PASS |
| AR / RTL direction | PASS |
| Visible layout clipping | NO |
| Visible control overlap | NO |
| Visible horizontal overflow | NO BLOCKING ISSUE |
| Raw translation keys | NO |
| Raw material enum in Arabic | NO |
| Raw required-part status in Arabic | NO |
| Raw SLA status in Arabic | NO |
| Raw escalation enum in required surfaces | NO |

Visually confirmed localized labels include Arabic "خدمة خارجية" / "ضمن الوقت" /
"قيد التنفيذ" / "جاهزية الإغلاق" and English "External Service" / "On Track" /
"In Progress" / "Completed". English text inside Arabic pages originating from stored
synthetic fixture/business data (test titles, descriptions, machine names, the
"Administrator" display name) is classified as business data, not an untranslated UI
literal. This visual PASS applies to the required R2-I certification surfaces only; it is
not a claim of repository-wide localization perfection.

```text
OWNER_VISUAL_REVIEW=PASS
R2_I_VISUAL_SCREENSHOT_PROOF=PASS
VISUAL_PROOF_BLOCKED_BY_TOOL_CAPABILITY=NO_LONGER_BLOCKING
EN_LTR_BROWSER=PASS
AR_RTL_BROWSER=PASS
RAW_MATERIAL_VISIBLE_AR=NO
RAW_REQUIRED_PART_STATUS_VISIBLE_AR=NO
RAW_SLA_STATUS_VISIBLE_AR=NO
RAW_ESCALATION_LEVEL_VISIBLE_AR=NO
```

### 5.2 Certification disposition

```text
R2_I_STATUS=CLOSED
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
R2_I_VISUAL_SCREENSHOT_PROOF=PASS
R2_I_VISUAL_REVIEW=OWNER_PASS_2026-09-29
R2_J_READY=YES
```

Runtime proof classification per chain: Frontend → API → Permission → Service →
Database → Audit → Result verified for create, request parts, work-order costs,
installed-part replacement, tenant/branch denial, permission denial, ledger posting,
audit rows, EN/AR, RTL/LTR, and production zero-mutation. Reported honestly:
**COMPLETE** for automated evidence.

## 6. Known limitations

- The 7 screenshots are retained outside the repository (repo convention); the owner's
  visual review (2026-09-29) reported no blocking defect, so this is no longer a blocker.
- Lint tooling unavailable locally (pre-existing; not a regression).
- Web-logic/API Jest teardown warning and shared AuditLog tenant columns remain the
  documented pre-existing platform limitations.
- Rate limiter counts every login attempt per `ip:email` (min 3); each harness run used
  a single admin login on a freshly restarted API to avoid 429 interference.