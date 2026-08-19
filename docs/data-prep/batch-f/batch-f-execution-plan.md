# Batch F — Execution Plan

**Date**: 2026-08-19
**Status**: FROZEN (pending DB auth resolution)
**Pre-requisite**: Pre-import proof PASS (see `docs/proofs/batch-f-joubah-preimport-proof.md`)

---

## 1. Pre-Execution Checklist

- [x] Manifest v3.0 validated (307 records, 0 BLOCKED)
- [x] Dry-run PASS (300/300 resolve, 0 errors)
- [x] Import script compiled and tested
- [x] Null resolution map generated
- [ ] DB auth issue resolved (section 6.1 of pre-import proof)
- [ ] Pre-import backup taken (optional but recommended)

---

## 2. Import Execution Steps

### Step 1: Resolve DB Auth
Fix the PrismaMssql integrated security issue for ts-node scripts.

### Step 2: Take Pre-Import Backup
```sql
BACKUP DATABASE [ATsoftERP_DB]
TO DISK = 'C:\backups\ATsoftERP_DB_batch_f_pre.bak'
WITH FORMAT, NAME = 'ATsoftERP_DB Pre-Batch-F Import';
```

### Step 3: Execute Import
```bash
cd apps/api
npx ts-node scripts/batch-f-importer.ts --execute
```

### Step 4: Verify Ledger
Check `docs/data-prep/batch-f/batch-f-import-ledger.json` for:
- `summary.failed = 0`
- All entries have `status: "created"` or `status: "reused"`

### Step 5: Post-Import Validation
1. Row count delta matches expected (+298 CREATE, +8 auto-create)
2. No orphaned records (all FKs valid)
3. No duplicate codes
4. All cutover dates = 2026-08-19

### Step 6: Post-Import Regression
```bash
cd apps/api
npx jest --forceExit
```
All existing tests must continue to pass.

---

## 3. Rollback Plan

If import fails mid-transaction:
1. The Prisma transaction will auto-rollback (single transaction)
2. If partial commit occurred, restore from backup

If import succeeds but validation fails:
1. Restore from backup
2. Investigate failures
3. Fix importer and re-run

---

## 4. Expected Record Counts (Post-Import)

| Table | Pre-Import | Delta | Post-Import |
|-------|-----------|-------|-------------|
| companies | existing | 0 | same |
| branches | existing | +3 | +3 |
| administrations | existing | +40 | +40 |
| departments | existing | +152 | +152 |
| job_titles | existing | +29 | +29 |
| operational_people | existing | +23 | +23 |
| maintenance_personnel | existing | +12 | +12 (8 manifest + 4 auto) |
| operational_person_assignments | existing | +23 | +23 |
| machine_responsibility_assignments | existing | +20 | +20 |
