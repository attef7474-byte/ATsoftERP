# Batch F — Joubah Import Execution Proof

| Field | Value |
|-------|-------|
| Batch | F |
| Scope | Controlled Joubah organizational data import |
| Manifest version | 3.1 |
| Execution date | 2026-08-19 |
| Driver | msnodesqlv8 (raw, authorized fallback F-12) |
| Auth | Windows Integrated (ODBC Driver 17 for SQL Server) |
| Database | ATsoftERP_DB (SQL Server 2016 SP2-GDR, DESKTOP-HJALRR4\WINCC, port 50079) |

---

## 1. Execution Summary

```
BATCH_F_EXECUTION              = COMMITTED
TRANSACTION_ISOLATION          = SERIALIZABLE
TRANSACTION_OUTCOME            = SINGLE COMMIT
MANIFEST_VERSION               = 3.1
TOTAL_RECORDS                  = 307
PHYSICAL_DB_CREATES            = 286 (derived from DB delta)
PHYSICAL_DB_REUSES             = 2
PHYSICAL_DB_SKIPS              = 19 (0 created)
FAILED_ROWS                    = 0
UNAUTHORIZED_CREATES           = 0
PREEXISTING_RECORDS_UPDATED    = 0
PREEXISTING_RECORDS_DELETED    = 0
```

---

## 2. Physical Database Creates by Entity

| Entity | Expected | Actual DB Delta | Verified |
|--------|----------|-----------------|----------|
| Branch | 3 | +3 (7→10) | **VERIFIED** |
| Administration | 40 | +40 (3→43) | **VERIFIED** |
| Department | 152 | +152 (4→156) | **VERIFIED** |
| JobTitle | 29 | +29 (0→29) | **VERIFIED** |
| OperationalPerson | 23 | +23 (33→56) | **VERIFIED** |
| OperationalPersonAssignment | 23 | +23 (0→23) | **VERIFIED** |
| MaintenancePersonnel | 8 | +8 (31→39) | **VERIFIED** |
| MachineResponsibilityAssignment | 8 | +8 (62→70) | **VERIFIED** |
| **TOTAL** | **286** | **+286** | **VERIFIED** |

Note: `PHYSICAL_DB_CREATES = 286` is derived from the pre-import snapshot (captured before transaction BEGIN) and post-import snapshot (captured after COMMIT). NOT derived from the manifest count.

---

## 3. Execution Timeline

1. **Pre-import snapshot**: All 13 table counts captured
2. **ID generation**: 286 CUID v1 IDs generated, 0 collisions with existing DB
3. **Transaction BEGIN**: SERIALIZABLE isolation level
4. **Phase 0**: Company COM-000001 REUSE
5. **Phase 1**: 3 Branch CREATE + 1 REUSE
6. **Phase 2**: 40 Administration CREATE
7. **Phase 3**: 152 Department CREATE (parent-first ordering)
8. **Phase 4**: 29 JobTitle CREATE
9. **Phase 5**: 23 OperationalPerson CREATE
10. **Phase 6**: 23 OperationalPersonAssignment CREATE
11. **Phase 7**: 8 MaintenancePersonnel CREATE
12. **Phase 8**: 8 MachineResponsibilityAssignment CREATE
13. **Post-import snapshot**: All 13 table counts captured, deltas match expected
14. **Transaction COMMIT**: Successful, single commit

---

## 4. Cutover Date

```
MIGRATION_CUTOVER_DATE = 2026-08-19
```

Applied to:
- 23 OperationalPersonAssignment records: `effectiveFrom = 2026-08-19`
- 8 MachineResponsibilityAssignment records: `startDate = 2026-08-19`

This is a MIGRATION CUTOVER DATE only. Not claimed to be actual employment or assignment start date.

---

## 5. Backup

```
BACKUP_FILE = ATsoftERP_DB_BatchF_PreImport_20260819_042143.bak
BACKUP_SIZE = 6866 pages (541.824 MB/sec)
BACKUP_FORMAT = SQL Server native, no compression (Express Edition)
RESTORE_VERIFYONLY = PASS ("The backup set on file 1 is valid.")
```

---

## 6. Driver Recovery Proof

The original application uses PrismaMssql (mssql/tedious) for database access. On this machine, mssql/tedious cannot authenticate via Windows Integrated Authentication (known F-12 issue). The authorized fallback to raw msnodesqlv8 was used for Batch F only.

```
DB_AUTH_RECOVERY = AUTHORIZED_FALLBACK
DRIVER_USED = msnodesqlv8 (raw, NOT mssql/msnodesqlv8 wrapper)
APPLICATION_DB_ADAPTER = UNCHANGED (PrismaService, PrismaModule, PrismaMssql)
DATABASE_URL = UNCHANGED
NO_SQL_AUTH_ENABLED = CONFIRMED
```

---

## 7. What Was NOT Changed

- No Prisma schema changes
- No migration files created or modified
- No application code changes (apps/api/src/ untouched)
- No OrganizationalUnit records created or modified
- No existing records updated or deleted
- No environment files modified
- No git operations performed

---

Generated: 2026-08-19
Status: **COMPLETE**
