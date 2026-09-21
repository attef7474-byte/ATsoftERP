# COST-R2D-B2 — allocation engine implementation contract

Base: `74587e6936bee5fc2cf431713d2ddcfbce0f587c`. New isolated branch `cost-r2d-b2-final-20260915`; initial worktree clean. Original dirty main at `20c5e1ec53b8a873e56018c5374254d3dfb75e67` is preservation-only.

## Authority and resolved blocker

Recovered A2/R1/R2/R3 chain is retained under `ATsofterp-COST-R2D-B2-CONTRACT-20260914` in local evidence; no repeated contract recovery. Primary selected report `prt_069970abf00174T7AQAZFSXg20` (2026-09-03T23:25:01Z) defines B2 close/pool/derivation + allocation engine, B3 ledger/reconciliation. Owner R1 `prt_069a6f497001zwEH9dLIw26Qq3` fixes purpose pools/line identity; owner R2 `prt_069c05249001Jk163LOl3IEyJF` and report `prt_069c14898001WMChnzPP4gfGvz` fix costClosedAt membership and source-cost-center provenance; owner R3 `prt_069c42730001B8g6GfHlF3pBs7` fixes CLOSED_SERVER_ENUM and preserves other decisions.

The original blocker was real: 0.0003 / five equal targets, HALF_UP(4), remainder to first target produces -0.0001. Its report remains unchanged. Owner attachment `e8760524-d70d-4d4d-a2c3-6b8457fba611/pasted-text.txt` explicitly ratifies rejecting the entire calculation/finalization for ANY final line <=0.

`B2_CONTRACT_PROVEN=PASS`; `B2_ROUNDING_SIGN_POLICY=FROZEN`; zero/negative final lines reject entire allocation; target dropping forbidden; rounding algorithm unchanged.

## Exact scope

IN_B2: derived company/branch/period/costPurpose pools; fixed FINAL_GOOD_OUTPUT_QUANTITY; cost-closed ProductionRun targets in [periodFrom, periodTo) by costClosedAt; allocation DRAFT → FINAL; stateless calculation preview; immutable final lines; technical source-membership claims; permissions, audit, concurrency, AR/EN operational UI and API.

ALREADY_B1: positive Decimal source amounts, finalized sources, terminal closed periods, categories, purposes, currency, source cost-center provenance, bounded mirrors. Only Prisma inverse-relation declarations may be added to existing models; their physical columns, indexes, checks, FKs, migrations and lifecycle stay unchanged.

LATER_PHASE: OperationalCostTransaction adapter/posting, ledger reconciliation, reversal/replacement.

OUT_OF_B2: configurable rule CRUD, alternate/manual drivers or targets, time proration, period reopening, source lifecycle changes, FX, GL/AP, utility imports, energy metering, depreciation engine, inventory/FG capitalization, material-snapshot monetary changes. UNKNOWN_SCOPE_ITEM_COUNT=0.

## Execution boundary and models

1. OperationalOverheadPeriodAllocation: one B2 allocation identity/version (1) per closed period. Unique period and exact company/branch/clientRequestId prevent parallel incompatible drafts/finals. Currency and period-boundary snapshots derive from authoritative records. Notes editable only DRAFT. FINAL immutable; no delete/reopen endpoint.
2. OperationalOverheadAllocationLine: target/purpose grain; exact unique allocationId + bounded productionRunKey + costPurpose. Immutable final driver quantity/unit/snapshot ID, membership timestamp, purpose-pool amount, total driver, final amount, currency, target and destination cost center. Snapshot amounts are server-derived evidence, never independent writable sources.
3. OperationalOverheadAllocationSource: provenance-only source-entry claim, sourceEntryId primary key; no monetary input. References the unchanged finalized B1 entry and its allocation; prevents double claiming at DB level.

All three carry direct tenant scope. Legacy parent FKs stay NVARCHAR(1000); locally owned IDs/period/entry FKs are NVARCHAR(200). Indexed legacy references use exact bounded mirrors with trusted source-length, DATALENGTH and BIN2 equality CHECKs. Every physical key is enumerated in the companion key matrix before migration execution.

## Monetary calculation

Per purpose, sum all finalized eligible source amounts with Decimal. No category/source-cost-center economic partition. All eligible targets participate in each nonempty purpose pool. Reject empty sources/targets, invalid/mismatched currency, invalid driver or destination reference.

Necessary feasibility: pool >= targetCount * 0.0001. Compute proportional shares using a dedicated high-precision Decimal constructor (never alter shared Decimal configuration), HALF_UP(4), then exact remainder to largest driver / lexically lowest stable target ID. Validate ALL final lines >0 and representable as DECIMAL(19,4), and exact per-purpose/global conservation. Failure occurs before any final row insertion and rolls back the transaction. No target pruning, clamping, alternative algorithm or source mutation.

## Finality and concurrency

Require B1 period CLOSED and periodTo <= current server time before accepting an allocation. This does not change B1 close semantics; it prevents finalizing an incomplete time-membership window. Read all bounded-period inputs under Serializable and the identical company/branch lock resource already used by B1. Limit oversized work by rejecting it entirely, never silently truncating sources/targets.

Production valuation-close additionally acquires this branch boundary BEFORE its existing run lock and before setting costClosedAt. This adjacent integration is necessary: a delayed valuation-close cannot backdate an eligible target after an allocation's final read. Existing run-close logic, snapshot monetary fields and run lock remain intact. A denied/failed boundary makes no writes.

Calculate/preview is not persisted and not final authority. Finalize recomputes from authoritative inputs under lock, then inserts all source claims/lines, transitions header and writes successful audit in one transaction. Repeated finalize of the same FINAL identity returns the immutable result without inserting or auditing again.

## API/UI/actions

Dedicated B2 controller under `production/overhead-allocations`, not B1 controller: list/details, closed-period lookup, create DRAFT, update notes on the same DRAFT, calculate preview, finalize, paginated lines/sources and audit history. Separate B2 read/create/update/calculate/finalize permission keys, idempotent seed, real guards/context. No unsupported cancel/delete action.

Minimal AR/EN page under `/admin/production/cost/overhead-allocations` reuses shared controls/error/permission/context patterns. Only period selection and optional notes are manual; money, targets, driver, currency, ownership and states are server-derived. No B1 CRUD UI expansion.

## Validation/release plan

Focused engine/service/DTO/controller/security/database-contract tests and all owner monetary cases; generate exact client; new full zero-replay SQL Server DB; physical parity and fresh-client authenticated proof; B1 and full API/Web regression, typechecks/builds, i18n/raw keys/routes/UI baseline/browser proof.

Only then implementation commit and frozen migration SHA; new COPY_ONLY CHECKSUM Production backup, VERIFYONLY and real restore clone; exact migration/catalog/runtime/engine/recovery rehearsal; precondition recheck; service-controlled exclusive Production DDL, acceptance, supported Prisma resolve, exact-commit deployment/hash parity, health/authenticated read proof, full final regression, docs-only commit and normal fast-forward push. No B3; no destructive reset or manual history writes. Report all gates honestly.
