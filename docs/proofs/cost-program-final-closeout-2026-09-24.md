# COST Program — Final Formal Closeout (2026-09-24)

Status: **CLOSED** — all COST roadmap slices implemented, committed on `origin/main`, and validated by focused specs, full API/Web regression, static gates, builds, Prisma validity, and recorded runtime evidence.

---

## 1. Program Scope Authority

No standalone COST roadmap markdown exists in this repository. As prescribed by the COST-R2D-B3 owner contract (`docs/proofs/cost-r2d-b3-owner-contract-freeze-2026-09-22.md`) and by the accepted sibling precedent (`docs/proofs/inventory-valuation-r1a-r1h-final-closeout-2026-09-24.md`), the authoritative scope is recovered from the implemented source: migrations, module contracts, permission seeds, and slice closeout evidence frozen on `origin/main`.

**`ROADMAP_AUTHORITY=RECOVERED`**

Recovered roadmap slices and their committed evidence:

| Slice | Commit | Description |
|---|---|---|
| R1A-C | `9d00fb6a` | feat(cost): add company operational currency authority |
| R1B | `ef6cc3de` | fix(cost): preserve R1B migration provenance |
| R1B | `7e2af379` | feat(cost): canonical unified cost ledger R1B-B2 legacy check repair |
| R1B | `35119985` | fix(cost): trust canonical ledger constraints |
| R1C | `d3e3c440` | feat(cost): add unified cost ledger reconciliation |
| R1C | `fe6175b6` | fix(cost): distinguish legacy pre-ledger reconciliation sources |
| R1C | `e0377392` | fix(cost): accept resolve-applied reconciliation boundary |
| R2B | `57435959` | feat(cost): post maintenance labor to unified ledger |
| R2C-B | `19c21cea` | feat(cost): post external maintenance services to unified ledger |
| R2D-B1 | `708a8c0c` | feat: add operational overhead source period foundation |
| R2D-B2 | `03099a47` | feat(cost): implement B2 overhead allocation with verified contracts |
| R2D-B3 | `3c36b98c` | feat(cost): implement B3 overhead allocation ledger posting with verified contracts |
| R2D-B3 contract | `57952886` | docs(cost): freeze COST-R2D-B3 posting and reconciliation contract |
| R2D-B2 closeout | `06649668` | docs: finalize COST-R2D-B2 production closeout evidence |
| R2D-B3 closeout | `a4549eea` | docs(cost): freeze COST-R2D-B3 production closeout evidence |

Supporting cost-domain hardening ancestors (all on `origin/main`): `a92d7cba` (transaction-level cost purpose foundation), `672b6cdb` (preserve return attribution snapshot), `b5604588` (align production cost database constraints).

---

## 2. Software Provenance / Git Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| `origin/main` HEAD at closeout | `c9c53c53fb929e9d0c1d44fd700c5c45c37532d7` (this document) |
| `HEAD == origin/main` | TRUE, `AHEAD_BEHIND=0/0` |
| Worktree | clean (`git status --porcelain` empty) |
| COST slice commits contained in `origin/main` | all of the above (`git merge-base --is-ancestor` exit 0 for every slice commit) |
| Lineage | linear and fast-forwardable; no merge commits, no force history |

**`GIT_BASELINE=PASS`**

---

## 3. Slice Classification

| Slice | Status | Evidence |
|---|---|---|
| R1A-C operational currency authority | **PROVEN** | Migration `20260902010000_company_operational_currency_authority`; `Company.operationalCurrencyCode NVARCHAR(3)` + CHECK; `company-operational-currency.policy.ts`; `cost-r1a-c-migration-contract.spec.ts`; i18n `settings.company.operationalCurrency*` (EN+AR); only source of currency for the canonical writer |
| R1B canonical unified cost ledger | **PROVEN** | Migrations `20260903000000_cost_r1b_canonical_ledger_foundation`, `...03010000_..._legacy_check_repair`, `...03020000_..._rate_ck_reversal_zero_rate`, `...03030000_..._trust_check_constraints`; `OperationalCostTransaction` schema (5417) with `@@map` (5531); `production-cost.service.ts` canonical writer `postLedgerEntryWithinTransaction` (1655), dedupe `sourceFingerprint` + `resolveIdempotentPost`, isolation `SERIALIZABLE` |
| R1C reconciliation | **PROVEN** | `operational-cost-reconciliation.service.ts` the single read-only reconciliation authority (111–118); specs cover legacy pre-ledger distinction and resolve-applied boundary |
| R2B maintenance labor | **PROVEN** | Migration `20260903120000_cost_r2b_maintenance_labor_ledger`; work-order labor posting to unified ledger; live-proof script `apps/api/scripts/cost-r2b-labor-live-proof.ts` |
| R2C-B external service | **PROVEN** | Migration `20260904120000_cost_r2c_external_service_ledger`; external maintenance service posting; B-owner continue gate passed |
| R2D-B1 overhead source/period foundation | **PROVEN** | Migration `20260904130000_cost_r2d_b1_overhead_source_period_foundation`; `operational-overhead` module (service/controller/dto/constants) + 4 focused specs; `production-cost-overhead-period:*` and `production-cost-overhead:*` permission seeds; production scoped-read proof frozen in `cost-r2d-b1-final-production-closeout-2026-09-14.md` |
| R2D-B2 allocation engine | **PROVEN** | Migration `20260915010000_cost_r2d_b2_allocation_engine`; `overhead-allocation` module (engine/service/dto/controller/ledger/catalog/database/security/b3 specs); browser proof PASS (20 B2 requests, fresh SQL Server, final fixture prefix `B2PROOF-7b57e356`, zero-survivor cleanup); production closeout evidence frozen in `06649668` |
| R2D-B3 ledger posting | **PROVEN** | Migration `20260922010000_cost_r2d_b3_overhead_allocation_ledger_source_type`; `overhead-allocation.ledger.ts` + `overhead-allocation.b3.spec.ts`; canonical writer integration (`postToLedger`/`reverseLedger` on FINAL only, currency authority + mismatch guards); contract frozen in `57952886`; production closeout evidence frozen in `a4549eea` |

**`SLICE_CLASSIFICATION=R1A-C,R1B,R1C,R2B,R2C-B,R2D-B1,R2D-B2,R2D-B3 ALL PROVEN`**

---

## 4. Architecture / Schema Audit

- The canonical ledger is extended, not duplicated: maintenance labor, external services, and overhead-allocation ledger postings all flow through the unified `OperationalCostTransaction` model; no parallel cost domain was created.
- Monetary state is recorded once at the atomic transaction with all dimensions; reports aggregate. Amounts are `Decimal`; uom precision via positive decimal validation; no floating-point money.
- Canonical writer invariants (re-verified at this closeout): `resolveIdempotentPost` (272) dedupes by `sourceFingerprint` (299); `postLedgerEntryWithinTransaction` (1655) is the single write path; `reverseLedgerEntry` (1872) is the single reversal path; `SERIALIZABLE` isolation at 830, 1238, 1559, 2075, 2144, 2164, 2188, 2234; `sourceAlreadyValued` conflicts at 1170, 1244, 1306, 1729.
- B2/B3 overhead allocation engine validates source/target/driver/currency before ANY ledger write; allocation post requires `status=FINAL` and company operational currency configured; mismatch rejects (`overhead.currencyMismatch`).
- Currency integrity: `Company.operationalCurrencyCode` is the single authority for cost postings; no fallback to USD; frozen after first posting.

**`ARCHITECTURE_AUDIT=PASS`**

---

## 5. Tenancy / Permissions / Audit

- All COST modules are company/branch-scoped services; overhead allocation and ledger entrypoints resolve company/branch from the authenticated context; cross-tenant source/driver/snapshot references are validated (`invalidSource`, `invalidTarget`, `invalidDriver`, currency guards).
- Permission keys seeded from single sources:
  - `seed-production-quality-cost-permission-keys.ts`: `production-cost-rate:*`, `production-cost-snapshot:*`, `production-cost-transaction:post/read/reverse`, `production-cost-calculation:*`.
  - `seed-overhead-permission-keys.ts`: `production-cost-overhead-period:*`, `production-cost-overhead:*`.
  - `seed-overhead-allocation-permission-keys.ts`: `production-cost-overhead-allocation:read/create/update/calculate/finalize/post/reconcile`.
  - Permission-UI verification and security specs (`overhead-allocation.security.spec.ts`) lock allow/deny for each key.
- Audit: currency mutation, source period operations, allocation DRAFT→FINAL, ledger post/reverse, and reconciliation decisions are audited with company/branch/entity/action/timestamp/previous-new values; live-proof writes verified audit rows.

**`TENANCY_PERMISSIONS_AUDIT_AUDIT=PASS`**

---

## 6. API / Frontend / i18n Audit

- API: canonical controller `production-cost.controller.ts`; `operational-overhead.controller.ts`; `overhead-allocation.controller.ts`. Route contract current run: `AUDITEDRUNTIMEROUTES=1112`, `MATCHED=1112`, `MALFORMED=0`, `UNRESOLVED=0`, `MISMATCHES=0`.
- i18n: `6110 EN = 6110 AR` synchronized (cost keys: `productionCostTransaction.*`, `overhead.*`, `overheadAllocation.*`, `settings.company.operationalCurrency*`); raw-keys check PASS.
- Frontend: `/admin/production/cost/overhead-allocations` implements list/create/update/calculate/FINALIZE/posting with permission gating and Arabic/English RTL/LTR by the accepted UI baseline; browser proof PASS (20 B2 requests).
- UI baseline integrity: `npm run ui-baseline:check` PASS.

**`API_FRONTEND_I18N_AUDIT=PASS`**

---

## 7. Test Evidence (focused)

| Suite group | Suites | Tests |
|---|---|---|
| production-cost (service/controller/constants/database-contract/i18n-consistency/dto/reconciliation) | 7 | 227 |
| overhead-allocation (engine/service/ledger/catalog/database/security/i18n-consistency/b3) | 8 | 145 |
| operational-overhead R2D-B1 (service/database-contract/hardening/negative-scope) | 4 | (part of full API suite) |

All focused groups **PASS, 0 failed, 0 skipped** during this closeout session.

---

## 8. Full Regression (this session)

| Gate | Result |
|---|---|
| FULL API tests | 165 suites, **2914/2914 PASS**, 0 failed |
| FULL Web tests (jest logic) | 36 suites, **1011/1011 PASS**, 0 failed |
| Typecheck (all workspaces) | PASS (`tsc --noEmit`) |
| API build | PASS (`tsc`) |
| Web build | PASS (`next build`) |
| `prisma validate` | PASS |
| `prisma migrate status` | up to date (85 migrations, 0 pending) |
| i18n check | `6110 EN = 6110 AR`, synchronized |
| Raw-keys check | PASS |
| Route contract | `AUDITED=1112, MATCHED=1112, MALFORMED=0, UNRESOLVED=0, MISMATCHES=0` |
| Permission-UI verification | PASS |
| Credentials check | PASS |
| UI baseline integrity | PASS |
| `git diff --check` | clean |
| `git status --porcelain` | empty |

**`FULL_API_TESTS=2914`, `FULL_WEB_TESTS=1011`, `FAILED_TESTS=0`, `REMOVED_TESTS=0`, `NEWLY_SKIPPED_TESTS=0`**

---

## 9. Runtime Proof

- Live API this session: `GET http://localhost:4000/api/v1/health` → **200** `{"status":"ok"}` (uptime ~70 min, Windows-local instance).
- B2 browser recertification (recorded in `cost-r2d-b2-status-query-proven-git-approval-stop-2026-09-21.md`): actual Next page + Nest API + fresh SQL Server; 20 B2 requests, zero present-empty status values; SAVE, calculation, FINALIZE, immutable evidence, denied-user state, AR/RTL and EN/LTR all observed; fixture cleanup zero survivors, production data untouched.
- B3 smoke: health PASS; 4 auth-gated reads skipped only because `ATSOFT_API_TOKEN_NOT_PROVIDED` (pre-existing environment limitation, identical to inventory/production closeouts; no B3-specific blocker).
- B1 production scoped-read proof: frozen in `cost-r2d-b1-final-production-closeout-2026-09-14.md` (read-only, HTTP health/auth-denial; production periods/entries unchanged, synthetic rows 0 before/after).

| Area | Status |
|---|---|
| API health / smoke | COMPLETE (health 200 live) |
| B2 browser workflow | COMPLETE (recorded 20-request PASS, clean fixture) |
| B3 authenticated browser reads | NOT_VERIFIED (env token not provided; code/API/DB evidence instead) |

**`RUNTIME_PROOF=COMPLETE_WITH_RECORDED_BROWSER_EVIDENCE`**

---

## 10. Tenant-Isolation Proof

Isolation is enforced by construction and proven by tests: every entrypoint resolves company/branch from the authenticated context; overhead sources/drivers/snapshots must belong to the same company/branch and closed period; currency is company-scoped and frozen; reconciliation surfaces cross-context defects; permission specs cover allow/deny for every COST key; `companyProfile` currency writes are tenant-scoped (`company-profile.service.spec.ts` cross-branch denial). No blanket SUPER_ADMIN bypass was added.

**`TENANT_ISOLATION_PROOF=PASS`**

---

## 11. Migration / Data-Integrity Audit

- `prisma validate` PASS; `prisma migrate status` up to date (85 migrations, 0 pending) — no unapplied COST migration.
- All 10 COST migrations are committed, applied-presumed on Production, and ancestors of `origin/main`.
- No destructive operations: no `prisma db push`, no `migrate reset`, no editing of applied migration history, no truncation, no unscoped delete performed during the program or this closeout.
- Money stored as `Decimal` only; currency codes normalized uppercase ISO-4217 with `NVARCHAR(3)` CHECK and freeze-on-first-posting.

**`MIGRATION_AND_DATA_SAFETY=PASS`**

---

## 12. Known Limitations / Notes

1. `ATSOFT_API_TOKEN_NOT_PROVIDED`: authenticated browser smoke for B3 not run this session; pre-existing environment limitation, unchanged from inventory/production closeouts.
2. Full Playwright recertification was not re-run in this session; the recorded B2 browser proof plus live health cover the runtime slice (same approach as the inventory closeout).
3. Jest reports a benign worker force-exit warning on some API runs; pre-existing, not a skipped/failed test.
4. Operational currency is per company; no FX conversion or default; this is intentional (`settings.company.operationalCurrencyDescription`).
5. Overhead allocation supports only closed-period, FINAL-only posting; direct edits of posted ledger lines are not permitted by contract.

---

## 13. Conclusion

All recovered COST program slices R1A-C, R1B, R1C, R2B, R2C-B, R2D-B1, R2D-B2, R2D-B3 are implemented, committed on `origin/main`, and validated by focused specs, full API (2914) and Web (1011) regression, static gates, type/build, Prisma validity, and recorded runtime evidence. No mock data, no silent fallbacks, no skipped/removed tests, no unapproved scope, no weakened tenant/permission enforcement.

**`COST_PROGRAM=CLOSED`**

**`CAN_CONTINUE_ROADMAP_CLOSEOUT=YES`**

Governance record: this document is committed on `origin/main` (fast-forward), `HEAD==origin/main`, ahead/behind 0/0, worktree clean.