# Spare-part expected life Phase 3 — additive migration clone proof

**Date:** 2026-11-20
**Branch:** `feat/spare-part-life-phase-3`
**Migration:** `20261120150000_add_spare_part_default_expected_life`
**Status:** `PASS` on disposable clone. Production migration and deployment remain separate gated steps.

## 1. Guardrails

| Item | Evidence |
|---|---|
| Source database URL | Loaded from root `.env`; credentials were never printed. |
| Parsing | Regex parsed only server and database names from `DATABASE_URL`; no `[Uri]` parse. |
| Server normalization | Prisma `host:port` was normalized to `host,port` for `sqlcmd`. |
| Target database | `ATsoftERP_EXCEL_20261117000316` from `.tmp/excel-master-data-20261117/clone.json`. |
| Production guard | `productionDatabase` in clone manifest is `false`; clone name differs from production database. |
| Authentication | Windows integrated authentication (`sqlcmd -E`) used for DDL. |
| Destructive operations | None. No reset, db push, truncate, delete, backfill, or applied-migration edit. |

## 2. Row-count reconciliation

Counts were identical before and after applying the additive migration.

| Table | Before | After |
|---|---:|---:|
| `products` | 132 | 132 |
| `spare_parts` | 13 | 13 |
| `machine_installed_parts` | 0 | 0 |
| `machine_installed_part_readings` | 0 | 0 |
| `inventory_movements` | 62 | 62 |
| `inventory_movement_lines` | 77 | 77 |
| `inventory_balances` | 20 | 20 |
| `spare_part_replacement_histories` | 0 | 0 |

## 3. DDL and constraint verification

| Check | Result |
|---|---|
| New columns before | `0 0 0` |
| New columns after | `1 1 1` |
| `default_expected_life_value` | nullable `FLOAT`, present |
| `default_expected_life_unit` | nullable `NVARCHAR(20)`, present |
| `default_warning_threshold_percent` | nullable `INT`, present |
| `spare_part_default_life_unit_ck` | present |
| `spare_part_default_life_value_ck` | present |
| `spare_part_default_warning_ck` | present |
| Legacy rows populated with non-null default life | `0` |
| `default_due_threshold_percent` column | absent |
| Migration history before / after | `0` / `1` |

## 4. Migration history

`prisma migrate resolve --applied 20261120150000_add_spare_part_default_expected_life` was run with a guarded clone-only `DATABASE_URL` override. The checker printed the target database name before execution and confirmed exactly one history row afterwards. The original `DATABASE_URL` was restored in the script's `finally` block.

## 5. Attempt note

The first guarded run applied the DDL successfully but stopped on an over-strict `sqlcmd` output-format assertion before recording migration history. The check was corrected to assert semantic values and to recognize that the DDL was already present; the second run verified constraints, null state, unchanged row counts, and recorded the migration exactly once. The issue and its preventive check were appended to `docs/governance/inspection-pitfalls-register.md` as P18.

## 6. Conclusion

The migration is additive, nullable, non-backfilling, and leaves product, spare-part, installed-part, reading, inventory-movement, inventory-balance, and replacement-history row counts unchanged. It is approved for the separately gated production migration step.
