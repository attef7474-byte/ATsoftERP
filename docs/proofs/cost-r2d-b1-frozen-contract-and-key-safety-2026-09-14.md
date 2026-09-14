# COST-R2D-B1 frozen contract and key safety

Evidence date: 2026-09-14. Implementation: `708a8c0ce0a6cb3d8c9f6fff5bb7aaddd529f009`.

This is the API-only overhead source/period foundation, not overhead allocation, an accounting ledger, or capitalization. The companion [production closeout](cost-r2d-b1-final-production-closeout-2026-09-14.md) records execution evidence and limitations.

## Authority and recovery

The accepted `implementation-contract.md`, `b1-source-fingerprints.json`, `b1-db-gates-evidence.json`, and the two historical fresh catalog sets under `%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B1-20260907T034615/` were reconciled against current source and SQL catalogs. Those artifacts record the D4CE migration, five required bounded mirrors, 16 CHECKs, six FKs, and nine safe indexes. The later stripped schema/migration was not the accepted contract. The proposed `finalize-source-contract.cjs` was declined, not executed, and was not used as authority.

The restored migration is byte-identical to the accepted migration fingerprint:

`20260904130000_cost_r2d_b1_overhead_source_period_foundation`

SHA256: `D4CE041F2C9D967950A9E0F0656E133EE7DBFAC5E3D56AD0E10794403FE66A0E`.

The final Prisma schema SHA256 is `97F815AE4CBA68AAC4A94D45A8F9D1312747012EDBD67CF08A0947DF9F334C53`. Its historical whole-file fingerprint is not claimed to be identical; the restored contract was validated independently. The five inverse relations in Company/Branch/CostCenter are the only additions to pre-existing models. Existing MIG-PROV models and migrations were not rewritten.

## Complete field matrix

`N(n)` means SQL Server `NVARCHAR(n)` / Prisma `String @db.NVarChar(n)`; lengths below are characters, not bytes. Legacy unannotated Prisma `String` fields remain SQL `NVARCHAR(1000)`. `DT` means `DATETIME2(7)` / Prisma `DateTime`. All non-null fields are required in the database; this does not imply they are client inputs.

### OperationalOverheadPeriod / operational_overhead_periods: 16 columns

| Field | SQL type | Nullable | Authority / default / mutability |
|---|---|---|---|
| id | N(200) | No | Prisma cuid; immutable clustered PK |
| companyId | N(1000) | No | Validated active context; immutable FK to companies.id |
| companyKey | N(200) | No | Server copy of companyId; required exact mirror |
| branchId | N(1000) | No | Validated active context; immutable FK to branches.id |
| branchKey | N(200) | No | Server copy of branchId; required exact mirror |
| code | N(100) | No | User code; nonempty; active uniqueness per company/branch under lock |
| periodFrom | DT | No | User boundary, inclusive; validated DRAFT/OPEN edits |
| periodTo | DT | No | User boundary, exclusive; must exceed periodFrom |
| status | N(20) | No | Server lifecycle; named SQL default N'DRAFT' |
| createdAt | DT | No | Server timestamp; SQL GETUTCDATE(), Prisma now() |
| updatedAt | DT | No | Prisma @updatedAt; no SQL default |
| createdById | N(1000) | No | Authenticated actor; immutable scalar evidence |
| updatedById | N(1000) | No | Authenticated actor on mutation |
| closedAt | DT | Yes | Server close timestamp; required when CLOSED |
| closedById | N(1000) | Yes | Closing actor; required when CLOSED |
| deletedAt | DT | Yes | Soft-deletion metadata; no client authority |

### OperationalOverheadEntry / operational_overhead_entries: 25 columns

| Field | SQL type | Nullable | Authority / default / mutability |
|---|---|---|---|
| id | N(200) | No | Prisma cuid; immutable clustered PK |
| companyId | N(1000) | No | Validated active context; immutable FK |
| companyKey | N(200) | No | Server copy of companyId; required exact mirror |
| branchId | N(1000) | No | Validated active context; immutable FK |
| branchKey | N(200) | No | Server copy of branchId; required exact mirror |
| periodId | N(200) | No | Validated tenant-owned OPEN period FK; no reassignment |
| reference | N(100) | No | User reference; nonempty; active uniqueness within period under lock |
| overheadCategory | N(30) | No | One closed category, distinct from cost purpose |
| costPurpose | N(30) | No | One canonical existing cost purpose |
| description | N(2000) | No | User source description |
| amount | DECIMAL(19,4) | No | Single positive monetary authority; Prisma Decimal |
| currencyCode | N(3) | No | Company.operationalCurrencyCode; never a client override |
| incurredAt | DT | No | User source date within half-open period |
| sourceCostCenterId | N(1000) | No | Validated ACTIVE same-company, compatible-branch cost-center FK |
| sourceCostCenterKey | N(200) | No | Server copy of sourceCostCenterId; recomputed on permitted provenance edit |
| status | N(20) | No | Server lifecycle; named SQL default N'DRAFT' |
| finalizedAt | DT | Yes | Server timestamp; required when FINALIZED |
| finalizedById | N(1000) | Yes | Finalizing actor; required when FINALIZED |
| notes | N(2000) | Yes | Optional user source note |
| externalDocumentReference | N(200) | Yes | Optional user reference; no external posting |
| createdById | N(1000) | No | Authenticated creator; immutable scalar evidence |
| updatedById | N(1000) | No | Authenticated actor on mutation |
| createdAt | DT | No | Server timestamp; SQL GETUTCDATE(), Prisma now() |
| updatedAt | DT | No | Prisma @updatedAt; no SQL default |
| deletedAt | DT | Yes | Server soft-delete of DRAFT entry while period OPEN |

Editable entry business fields are mutable only while the entry is DRAFT and its period is OPEN. FINALIZED entries and CLOSED periods are immutable. Actor fields are scalar audit evidence, not additional user FKs; the six actual FKs are listed below. No DB default silently supplies a missing mirror.

## Write authority and DB enforcement

DTO unknown-field rejection excludes company/branch overrides, mirror fields, client currency, and allocation fields. The service derives companyKey/branchKey from validated context on creation, and sourceCostCenterKey from the validated source cost center on creation and permitted updates. Scoped reads include companyId, branchId, companyKey, and branchKey. A missing context fails closed.

Each of the five mirror CHECKs requires source DATALENGTH <= 400, equal source/mirror DATALENGTH, and equality under `Latin1_General_100_BIN2`. Both columns are NOT NULL. This prevents NULL acceptance, truncation, case folding, and trailing-space mismatches. Fresh-client runtime directly attempted NULL, mismatch, and over-bound writes: all rejected. No hash column, computed mirror, trigger, permissive fallback, or client-selected mirror is used.

### All 16 CHECK constraints

The prefix `operational_overhead_periods_` has six checks:

| Suffix | Rule |
|---|---|
| period_ck | periodFrom < periodTo |
| status_ck | DRAFT / OPEN / CLOSED / CANCELLED only |
| close_meta_ck | CLOSED requires closedAt and closedById |
| code_ck | Trimmed code nonempty |
| companyKey_ck | Exact bounded company mirror |
| branchKey_ck | Exact bounded branch mirror |

The prefix `operational_overhead_entries_` has ten checks:

| Suffix | Rule |
|---|---|
| amount_ck | amount > 0 |
| category_ck | Nine accepted overhead categories only |
| status_ck | DRAFT / FINALIZED only |
| finalize_meta_ck | FINALIZED requires finalizedAt and finalizedById |
| currency_ck | Exactly three uppercase ASCII letters |
| reference_ck | Trimmed reference nonempty |
| companyKey_ck | Exact bounded company mirror |
| branchKey_ck | Exact bounded branch mirror |
| sourceCostCenterKey_ck | Exact bounded provenance mirror |
| purpose_ck | Existing eight-value canonical cost-purpose set |

All 16 are enabled and trusted on fresh replay, backup clone, and production. Cross-record rules (tenant compatibility, company-currency equality, overlap, active uniqueness and lifecycle) remain transactional service rules, not misleading claims of cross-table CHECK enforcement.

### All six foreign keys

| Constraint | Child -> parent | Child/parent declared bytes |
|---|---|---:|
| fk_operational_overhead_periods_company | periods.companyId -> companies.id | 2000 / 2000 |
| fk_operational_overhead_periods_branch | periods.branchId -> branches.id | 2000 / 2000 |
| fk_operational_overhead_entries_company | entries.companyId -> companies.id | 2000 / 2000 |
| fk_operational_overhead_entries_branch | entries.branchId -> branches.id | 2000 / 2000 |
| fk_operational_overhead_entries_period | entries.periodId -> operational_overhead_periods.id | 400 / 400 |
| fk_operational_overhead_entries_costcenter | entries.sourceCostCenterId -> cost_centers.id | 2000 / 2000 |

All are enabled/trusted, with NO ACTION on update/delete. Width mismatch count = 0; B1 SQL 1753 count = 0.

## Complete key-safety matrix

SQL catalog declared key bytes, including every key column, not sampled data lengths:

| Index | Kind | Ordered key fields | Bytes | Limit | Result |
|---|---|---|---:|---:|---|
| pk_operational_overhead_periods | Clustered PK | id | 400 | 900 | PASS |
| ix_operational_overhead_periods_status_range | Nonclustered | companyKey, branchKey, status, periodFrom, periodTo | 856 | 1700 | PASS |
| ix_operational_overhead_periods_code | Nonclustered | companyKey, branchKey, code | 1000 | 1700 | PASS |
| pk_operational_overhead_entries | Clustered PK | id | 400 | 900 | PASS |
| ix_operational_overhead_entries_period | Nonclustered | periodId, status | 440 | 1700 | PASS |
| ix_operational_overhead_entries_costcenter | Nonclustered | companyKey, branchKey, sourceCostCenterKey | 1200 | 1700 | PASS |
| ix_operational_overhead_entries_reference | Nonclustered | periodId, reference | 600 | 1700 | PASS |
| ix_operational_overhead_entries_category_incurred | Nonclustered | companyKey, branchKey, overheadCategory, incurredAt | 868 | 1700 | PASS |
| ix_operational_overhead_entries_purpose_incurred | Nonclustered | companyKey, branchKey, costPurpose, incurredAt | 868 | 1700 | PASS |

The 1200-byte index is nonclustered: its applicable limit is 1700, not the 900-byte clustered/PK limit. It is safe by declared width; it is not a waiver. No wide legacy FK participates directly in a B1 index. Seven secondary indexes are non-unique; active-only uniqueness is protected by the shared transaction lock and checks, not an invented permanent reference reservation.

`B1_UNSAFE_KEY_COUNT=0`; B1 index-width warnings = 0. This certifies the nine B1 keys and separately checked MIG-PROV targets, not unrelated legacy indexes across the whole database.

## Lifecycle, concurrency, and monetary authority

Periods use [from,to): DRAFT -> OPEN -> CLOSED; empty DRAFT -> CANCELLED. No reopen. Noncancelled periods cannot overlap; only one OPEN per company/branch; draft creation while another period is OPEN remains rejected. Boundary edits must not invalidate contained entries. Closing requires every surviving entry to be FINALIZED.

All overhead mutations take the same company/branch transaction-owned application lock before reading state, with Serializable isolation. A SHA256 of the company/branch tuple names the lock only; it is not a database identity or uniqueness substitute. Parallel identical entry submissions produced one 201 and one conflict; parallel opens produced one 200 and one 409. Unit coverage also pins the shared-lock boundaries and conflicting lifecycle behavior. Audit writes use the same transaction.

Categories: UTILITIES, RENT, DEPRECIATION, INSURANCE, INDIRECT_LABOR, INDIRECT_MAINTENANCE, FACTORY_SERVICE, ADMIN, OTHER. DEPRECIATION is a recorded source category, not a depreciation engine. MATERIAL, LABOR, EXTERNAL_SERVICE, DOWNTIME, and MACHINE are excluded direct-cost categories.

Cost purpose reuses MAINTENANCE, PRODUCTION, QUALITY, PROJECT, UTILITIES, ADMIN, DEVELOPMENT, OTHER. One scalar purpose belongs to each atomic source amount. Decimal strings preserve the complete DECIMAL(19,4) range; compatible conservative numeric payloads remain supported without floating-point monetary calculations. Zero, negative, excessive scale, overflow, exponential strings and nonfinite values are rejected. Company currency is derived and revalidated on finalization; no FX or currency override exists.

## Prisma/SQL drift interpretation

Fresh replay to Prisma diff contains exactly four B1 statements: drop/re-add each of the two named status defaults as `'DRAFT'` instead of existing `N'DRAFT'`. This is equivalent ASCII status-literal Unicode rendering, not a column, nullability, key, FK, or CHECK mismatch. No diff SQL was applied. The frozen D4CE migration was not changed to suppress it.

`B1_ALTER_COLUMN_COUNT=0`, missing B1 columns/indexes/checks/FKs = 0, unexpected B1 indexes = 0, unexplained B1 drift = 0. Raw B1 diff statements are four, not zero. Complete ordered catalog exports (41 columns, nine indexes, 16 CHECKs, six FKs) are byte-equivalent after joining SQLCMD JSON wrapping across the fresh replay, real backup clone, and production.
