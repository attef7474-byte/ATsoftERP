# Spare-part expected life Phase 3 — production migration proof

**Date:** 2026-11-20
**Database:** `ATsoftERP_DB` on the parsed production server
**Migration:** `20261120150000_add_spare_part_default_expected_life`
**Status:** `PASS`

## 1. Backup and safety

| Item | Value |
|---|---|
| Verified backup | `C:\Users\attef\AppData\Local\Temp\ATsofterp_pre_PHASE3_20261120_021828.bak` |
| Backup options | `COPY_ONLY, CHECKSUM` |
| Verification | `RESTORE VERIFYONLY ... WITH CHECKSUM` — passed |
| DDL authentication | Windows integrated authentication (`sqlcmd -E`) |
| Destructive operations | None. No reset, db push, truncate, delete, backfill, or applied-migration edit. |

## 2. Preconditions

| Check | Result |
|---|---|
| Migration history before | `0` |
| New columns before | `0 0 0` |
| Parsed database guard | `ATsoftERP_DB` |
| Clone proof | Passed on `ATsoftERP_EXCEL_20261117000316` before production run |

## 3. Row-count reconciliation

Counts were identical before and after applying the migration.

| Table | Before | After |
|---|---:|---:|
| `products` | 128 | 128 |
| `spare_parts` | 406 | 406 |
| `machine_installed_parts` | 3 | 3 |
| `machine_installed_part_readings` | 0 | 0 |
| `inventory_movements` | 74 | 74 |
| `inventory_movement_lines` | 89 | 89 |
| `inventory_balances` | 21 | 21 |
| `spare_part_replacement_histories` | 0 | 0 |

## 4. DDL verification

| Check | Result |
|---|---|
| New columns after | `1 1 1` |
| `spare_part_default_life_unit_ck` | present |
| `spare_part_default_life_value_ck` | present |
| `spare_part_default_warning_ck` | present |
| Rows populated with non-null default life | `0` |
| Migration history after | `1` |

`prisma migrate resolve --applied 20261120150000_add_spare_part_default_expected_life` was run after the DDL was verified. The target database name was printed before execution; credentials were never printed.

## 5. Conclusion

The production schema now contains the three additive nullable columns and their checks. No existing row was backfilled. Product, spare-part, installed-part, reading, inventory-movement, inventory-movement-line, inventory-balance, and replacement-history counts are unchanged.
