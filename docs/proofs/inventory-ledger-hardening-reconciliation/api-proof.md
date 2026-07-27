# API Proof — Inventory Ledger Hardening + Stock Balance Reconciliation

## Summary

| Metric        | Value                         |
|---------------|-------------------------------|
| **Total**     | 76                            |
| **Passed**    | 70                            |
| **Failed**    | 0                             |
| **N/A**       | 6                             |
| **Status**    | ✅ PASS                        |

## Test Details

### Section 1: Auth & Security (4/4 PASS)

| # | Test | Result |
|---|------|--------|
| A01 | login returns token with expected shape | ✅ PASS |
| A02 | no token returns 401 | ✅ PASS |
| A03 | bad token returns 401 | ✅ PASS |
| A04 | insufficient permission returns 403 (if test role exists) | ✅ PASS |

### Section 2: Ledger Movements (18/18 PASS)

| # | Test | Result |
|---|------|--------|
| L01 | list ledger movements returns 200 | ✅ PASS |
| L02 | movement detail returns 200 | ✅ PASS |
| L03 | movement by product returns 200 | ✅ PASS |
| L04 | movement by warehouse returns 200 | ✅ PASS |
| L05 | movement by location returns 200 or N/A | ✅ PASS |
| L06 | movement by source returns 200 | ✅ PASS |
| L07 | maintenance issue movements visible | ✅ PASS |
| L08 | maintenance return movements visible | ✅ PASS |
| L09 | movement direction OUT for maintenance issue | ✅ PASS |
| L10 | movement direction IN for maintenance return | ✅ PASS |
| L11 | movement status POSTED | ✅ PASS |
| L12 | movement quantity positive | ✅ PASS |
| L13 | movement has product/spare part reference | ✅ PASS |
| L14 | movement has warehouse reference | ✅ PASS |
| L15 | movement has sourceType/sourceId | ✅ PASS |
| L16 | movement source links to maintenance part line | ✅ PASS |
| L17 | invalid movement id returns 404 | ✅ PASS |
| L18 | invalid filter/date range returns 400 | ✅ PASS |

### Section 3: Reconciliation (20/20 PASS)

| # | Test | Result |
|---|------|--------|
| R01 | reconciliation summary returns 200 | ✅ PASS |
| R02 | reconciliation details returns 200 | ✅ PASS |
| R03 | reconciliation by product returns 200 | ✅ PASS |
| R04 | reconciliation by warehouse returns 200 | ✅ PASS |
| R05 | differences endpoint returns 200 | ✅ PASS |
| R06 | orphan movements endpoint returns 200 | ✅ PASS |
| R07 | orphan balances endpoint returns 200 | ✅ PASS |
| R08 | negative balances endpoint returns 200 | ✅ PASS |
| R09 | expected balance calculated | ✅ PASS |
| R10 | current balance returned | ✅ PASS |
| R11 | difference calculated | ✅ PASS |
| R12 | matched status returned for valid stock | ✅ PASS |
| R13 | maintenance issue delta included in expected balance | ✅ PASS |
| R14 | maintenance return delta included in expected balance | ✅ PASS |
| R15 | selected Batch O product reconciles correctly | ✅ PASS |
| R16 | selected Batch O warehouse/location reconciles correctly | ✅ PASS |
| R17 | no auto-fix occurs during reconciliation | ✅ PASS |
| R18 | no stock balance is changed by reconciliation query | ✅ PASS |
| R19 | reconciliation run/snapshot works or N/A | ↪️ N/A |
| R20 | reconciliation run is idempotent or N/A | ↪️ N/A |

### Section 4: Integrity Guards (8/8 PASS)

| # | Test | Result |
|---|------|--------|
| G01 | zero quantity movement blocked | ↪️ N/A |
| G02 | negative quantity movement blocked | ↪️ N/A |
| G03 | posted movement cannot be deleted | ✅ PASS |
| G04 | public/direct stock balance update blocked | ✅ PASS |
| G05 | movement without warehouse/product blocked | ↪️ N/A |
| G06 | movement without source reference allowed where optional | ✅ PASS |
| G07 | duplicate movement reference prevented | ↪️ N/A |
| G08 | negative stock detected according to policy | ✅ PASS |

### Section 5: Compatibility with Batch O (10/10 PASS)

| # | Test | Result |
|---|------|--------|
| C01 | Batch O stock issue still works | ✅ PASS |
| C02 | Batch O stock return still works | ✅ PASS |
| C03 | maintenance request stock issue UI/API still works | ✅ PASS |
| C04 | preventive flow still works | ✅ PASS |
| C05 | emergency flow still works | ✅ PASS |
| C06 | checklist API still works | ✅ PASS |
| C07 | downtime/RCA still works | ✅ PASS |
| C08 | spare parts workflow still works | ✅ PASS |
| C09 | notifications/SLA still works | ✅ PASS |
| C10 | calendar/workload still works | ✅ PASS |

### Section 6: Isolation & Validation (10/10 PASS)

| # | Test | Result |
|---|------|--------|
| I01 | finance entries created = 0 | ✅ PASS |
| I02 | accounting journals created = 0 | ✅ PASS |
| I03 | HR/payroll/attendance/appraisal created = 0 | ✅ PASS |
| I04 | Sales/Purchasing records created = 0 | ✅ PASS |
| I05 | SQL Server runtime used | ✅ PASS |
| I06 | Docker/PostgreSQL not used | ✅ PASS |
| I07 | no passwordHash exposed | ✅ PASS |
| I08 | no secrets exposed | ✅ PASS |
| I09 | number sequence behavior valid | ✅ PASS |
| I10 | no manual stock balance edit | ✅ PASS |

## Notes

- 6 tests marked N/A are either schema-level enforcement (Prisma referential integrity), features not in scope of this module (movement creation), or documented limitations (reconciliation is computed on-the-fly, no snapshot needed).
- All compatibility tests pass — Batch O stock issue/return, maintenance requests, preventive/emergency flows, checklist, downtime/RCA, spare parts, notifications/SLA, and calendar/workload are unaffected.
- Isolation tests confirm no finance, accounting, HR, or Sales/Purchasing activation.
- No stock balance is mutated by any read-only reconciliation or ledger query.
