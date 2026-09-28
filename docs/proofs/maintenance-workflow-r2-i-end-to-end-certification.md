# R2-I — End-to-end certification: STRICT STOP

Date: 2026-09-28. Program: MAINTENANCE-WORKFLOW-R2.

**Status: BLOCKED / NOT CLOSED. R2-J readiness: NO.**

This is a failed certification checkpoint, not a successful certificate. The owner
requires an immediate strict stop when a real source defect is discovered. No
application repair was attempted, and no successful certification commit was made.

## 1. Baseline and authority

The requested baseline commands were executed. The first sandboxed fetch could not
write `.git/FETCH_HEAD`; the authorized elevated retry succeeded. After fetch:

- Branch: `maintenance-workflow-r2`.
- HEAD / R2-H closeout: `47b974503e99eaa0411aec0fb471c8410f26fd56`.
- origin/main and merge base: `f14fbe13cf76e871b03a9029933a53e9ced950aa`.
- Divergence `origin/main...HEAD`: 0 remote-only, 25 local-only commits.
- Initial status, unstaged diff, staged diff and diff-check: empty/clean.
- R2-H closeout is HEAD; no post-closeout commits exist.
- Historical stash retained: `7af3a0e7d9d088063aefad72740f203f448c1595`,
  `stash@{0}`, paused Docker deployment experiment. No stash mutation.

Read the Engineering Constitution, Permanent Development Contract, repository
AGENTS.md, relevant database/backend/frontend/maintenance/inventory/testing rules,
UI baseline governance, all nine requested R2-A through R2-H proof documents,
including the R2-C browser addendum, and the final CLOSED Cost Program proof.
Historical PASS results were not counted as current R2-I passes.

Complete local program ancestry, oldest first:

```text
330accfb410aac84081f847f43b0d8ff85c3a41b R2-A canonical contract
75954b38e28bac7286dea8e3d1b488c949e0690b R2-B source
b519bdfbe219564fa1572307c26b36fcec68da10 R2-B closeout
b8c620544d0be7aad9288e436fc6c6f5e206d1d7 R2-C source
b816af5513f0233fad0ccc43206c1f6d1f0b9e7a R2-C closeout
ec903ff603c86dc21353921aa31768be44bc7623 Request detail hook-order fix
9e077cbaef6caf629343848ad9f4bb3630beb762 R2-C browser/real-DB addendum
7629db49938d7774c499fac32991263d5719aae7 Addendum commit reference
5a3d9be57bfafa5985df9075846db6cf70d97be0 Work-order start-guard localization
2950ecc78d738a34c0a7441046164a9b17f5f508 R2-D source
17a00825c0fada209ace1e584d1013a02fe5b12f R2-D closeout
935dca05818b28d0e3ea3f4e3cb371678c53f30e R2-E source
2182a0270f19395fe0b9b91bb202532a6327d6ff R2-E API localization
8d4a9cc3c1f5dc83370032a78946b4b76e12cdc8 R2-E closeout
f0fe2106303a95ca72350ae08631fe562edd3e96 Config build-artifact hygiene
fb35e29b8be6bb7eb00601e1b8e9454853100a74 Warehouse code/name search
667628764c0b06925e09e730ea3833a908e07617 R2-F source
a393d77babe3777515bf8ac462211a44ab15d614 R2-F closeout
437efa52f6cad80a5d9d7ef1333d34d98ed84654 R2-G source
38c6bc9f0da8d40c11c81a29d976bc108f0ce9f4 R2-G closeout
09e441844ef2394dc638876a56d617b61cfbb353 ConfirmDialog keyboard accessibility
22bedb6045073c18a27985c36da219fc48d4e458 R2-H source
8eb8a2f6a00c3d4844fc7544b218da143b11e6ca R2-H cost-summary tenant fix
a1f19018c6abbdf43d8655e625b9b1ac0f7bcce1 R2-H cost UI and throttle localization
47b974503e99eaa0411aec0fb471c8410f26fd56 R2-H closeout / certification target
```

## 2. Blocking defect: material cost loses request attribution

```text
CLASSIFICATION=R2_I_CERTIFICATION_DEFECT
DEFECT_ID=R2I-001
OWNER=PLATFORM
ORIGIN=COST-R1B material ledger projection
AFFECTED_PRIOR_PHASE=R2-H canonical maintenance cost reconciliation
EVIDENCE_CLASS=PROVEN_BY_SOURCE
RUNTIME_REPRODUCTION=NOT_RUN_STRICT_STOP
```

The frozen source cannot reconcile a positively valued request stock issue to its
request cost summary. The exact source chain at the certified HEAD is:

1. `apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.service.ts:633`
   calls `postMaintenanceMaterialLedgerEntry` for a newly valued issue. Its argument
   object contains movement/line/value/currency/context, but no request attribution.
2. That helper, at lines 41–81 (especially 75–78), calls the canonical writer with
   only `_currencyCodeFromInventory` and `_sourceKind` inside `refs`. Neither
   `maintenanceRequestId` nor `maintenanceWorkOrderId` is supplied.
3. `apps/api/src/modules/factory/production-cost/production-cost.service.ts:1764`
   takes only the explicit allowed reference fields from `opts.refs`. It does not
   traverse the inventory movement or required-part source to recover the request.
   The ledger create at line 1774 spreads those references at line 1804.
4. `apps/api/prisma/schema.prisma:5476` and `:5478` declare the two maintenance
   attribution fields nullable, with no default deriving them from a movement.
5. `apps/api/src/modules/factory/production-cost/maintenance-cost-summary.service.ts:70`
   scopes the request summary by `maintenanceRequestId: requestId`. The ledger query
   spreads that filter at line 114 and totals only its returned rows at line 154.
6. `apps/web/src/app/admin/maintenance/requests/[id]/cost/page.tsx:26` fetches this
   exact summary; line 60 displays its `netCost`.

Read-only clone catalog verification also found zero triggers on
`dbo.operational_cost_transactions`. Both maintenance attribution columns are
nullable with no default constraint. There is no database trigger/default that
fills the reference omitted by the writer.

Consequently, if the material posting succeeds, the new ledger row lacks the
request FK and cannot appear in this request summary. For example, a positive
material-only issue of value V contributes V to its source ledger row but zero to
the request-filtered material total. This is a source-derived consequence, not a
claim that an R2-I transaction of value V was executed.

`git blame` attributes the deficient material `refs` block to historical Cost
commit prefix `7e2af379e`; no R2-I source changes caused it. R2-H's new canonical
summary makes the missing attribution critical to the requested reconciliation.
Work-order material attribution must also be reviewed under the linked-request
single-part-authority contract; no allocation policy is invented here.

This satisfies the owner's strict-stop condition “a real source defect is
discovered.” It also prevents certifying section 35's equality between canonical
material cost and the request's displayed summary. Do not work around this by
inserting ledger rows directly, changing summary filters for the harness, or
ignoring material cost.

Required next action: a separately authorized repair of the maintenance material
attribution contract, with real valued-issue-to-summary regression proof, followed
by a fresh R2-I certification. No repair/backfill is authorized by this report.

## 3. R2-H historical posting gap: distinct from R2I-001

Read-only SQL on identity-proven `ATsoftERP_DB` confirmed:

- Cost entry `cmsc789hd0003dw95onnlfjiq`, type LABOR, amount 120.50,
  incurred at `2026-08-02 22:34:12.3340000`.
- Work order `cmsc6rqiw0007fw955704khux`, COMPLETED,
  completed at `2026-08-02 19:34:33.5520000`.
- Canonical ledger row count remains 0.

The existing row is historical missing-posting evidence. Current work-order
completion source posts positive LABOR and EXTERNAL entries in the completion
transaction, and returns already-COMPLETED work orders without backfilling them
(`maintenance-work-orders.service.ts`, completion implementation around lines
861–916). However, the owner's A/HISTORICAL_DATA_ONLY definition additionally
requires proving all NEW operations correct; that conclusion was not established.

```text
R2H_EXISTING_ROW_CLASSIFICATION=HISTORICAL_UNPOSTED_LABOR
R2H_POSTING_GAP_CLASSIFICATION=NOT_VERIFIED_TO_REQUIRED_RUNTIME_STANDARD
R2I_NEW_CANONICAL_POSTING_GAP=NOT_VERIFIED
```

R2I-001 is a separate current attribution/reporting defect, not a runtime
reproduction of the historical labor gap. Production was not backfilled.

Frozen request-close policy recovered from R2-H: **Policy C — repair orders have
an independent lifecycle and do not block request completion or closure.** This
was read, not recertified at runtime in R2-I.

## 4. Disposable clone and production safety

Created fresh clone `ATsoftERP_R2I_CERT_20260928` on `localhost,50079` from
`ATsoftERP_DB` using COPY_ONLY + CHECKSUM backup and restore into new data/log
files. The restore completed successfully. No REPLACE, drop, reset, migration,
backfill or production data update was executed.

Backup retained:
`C:\Program Files\Microsoft SQL Server\MSSQL13.WINCC\MSSQL\DATA\R2I_CERT_20260928_copyonly.bak`.

Clone data/log files retained in the same directory:
`ATsoftERP_R2I_CERT_20260928.mdf` and `ATsoftERP_R2I_CERT_20260928_log.ldf`.

Independent SQL `SELECT DB_NAME()` returned the exact clone name. No R2-I fixture
write followed: the attribution defect was confirmed during source review before
starting a temporary runtime. Clone canonical ledger count at inspection: 0.

Production read-only scan after stopping:

| Table/scope | Current count |
|---|---:|
| Live maintenance requests | 7 |
| Required parts | 0 |
| Legacy request part usages | 0 |
| Legacy request cost entries | 0 |
| Work-order cost entries | 1 |
| Canonical cost transactions | 0 |
| Repair orders | 0 |

These match the frozen R2-H counts, but are not represented as a complete
same-session before/after fingerprint. R2I-CERT scans of request title/number,
work-order title/number, and inventory movement number/notes returned 0 each.
The full all-entity synthetic scan was not completed; no fixture mutation was
attempted anywhere. COPY_ONLY backup creates backup metadata; “no production
mutation” here means no application data/schema mutation, not absence of backup
history or ordinary SQL Server operational metadata.

Current production `inventory_movements` has camelCase columns matching the
current Prisma model at line 1822. The older proof's assertion of snake_case
mapping drift was not reproduced for this model. No schema was modified.

## 5. Gates not certified and cleanup

- Full business chain, inventory valuation, cost equality, old/new replacement,
  repair lifecycle, labor/external posting, close/terminal immutability, audit,
  non-admin denial and tenant recertification: **NOT_VERIFIED**.
- ConfirmDialog source was reviewed; actual focus trap/Escape/restoration, F9
  code/name runtime search and post-build artifact hygiene: **NOT_VERIFIED**.
- Full API/Web regressions, typechecks/builds, Prisma CLI gates, i18n/raw-key,
  route/permission/credential/UI-baseline gates: **NOT_RUN_STRICT_STOP**.
- Full test counts/failures/skips/removals: no current run; do not substitute the
  R2-H 3436/1113 baseline as R2-I results.
- EN/LTR and AR/RTL browser/visual proof: **NOT_VERIFIED**. No browser was started,
  no screenshots were taken; this is a defect stop, not a tool-capability block.
- No temporary API/Web process was started; no ports were assigned. Existing
  application services were not stopped, rebuilt, restarted or deployed.
- Authorized development account was not used. No password/token/cookie files
  were created, so there were none to delete.
- Clone retained for diagnosis; no certification fixtures exist in it.
- Safe out-of-repository artifact: full ancestry text under
  `C:\Users\attef\AppData\Local\Temp\ATsofterp-R2I-CERT-20260928\ancestry.txt`.
- Deferred documented platform limitations remain unmodified: shared AuditLog
  tenant columns, lint setup, Jest teardown warning, repair-intake serialization.
  Their historical documentation is not a current runtime PASS.

## 6. Final disposition

```text
R2_I_STATUS=BLOCKED_STRICT_STOP
R2_I_CERTIFICATION_COMMIT=NONE
R2_I_APPLICATION_SOURCE_CHANGED=NO
R2_I_SCHEMA_CHANGED=NO
R2_I_MIGRATIONS_CREATED=0
R2_I_MIGRATION_REQUIRED=NOT_ESTABLISHED_FOR_SEPARATE_REPAIR
FULL_CHAIN_REQUEST_TO_CLOSE=NOT_VERIFIED
CANONICAL_COST_RECONCILIATION=BLOCKED_BY_SOURCE_ATTRIBUTION_DEFECT
R2_I_VISUAL_SCREENSHOT_PROOF=NOT_VERIFIED
VISUAL_PROOF_BLOCKED_BY_TOOL_CAPABILITY=NO
PRODUCTION_DB_MUTATED=NO_APPLICATION_DATA_OR_SCHEMA_WRITES
PRODUCTION_SYNTHETIC_R2I_ROWS=0_IN_SCANNED_REQUEST_WO_MOVEMENT_FIELDS
STASH_MUTATED=NO
ORIGIN_MAIN_UNCHANGED=YES
WORKTREE_CLEAN=NO_DOCUMENTATION_ONLY
R2_J_READY=NO
```

Only this proof document was created in the repository. Application source diff
against R2-H is empty. No commit, push, merge, tag or deployment was performed.
The successful-certification commit subject prescribed by the owner was not used
for this failed certification checkpoint.
Final tracked `git diff --check` passed; staged and tracked diffs were empty.
The only final status entry was this untracked documentation file.
