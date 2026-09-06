-- Migration: mig_prov_r1_key_safety_hardening_a_add_bounded_mirror_columns (ID-KEY-SAFE-R1 final package, phase 1 of 2)
-- Slot: BETWEEN 20260904125000_fix_sla_contract_and_width_drift AND B1 (20260904130000_cost_r2d_b1_overhead_source_period_foundation)
-- Phase 1: add bounded exact-equality MIRROR columns (nullable) WITHOUT referencing them in the same batch.
-- Phase 2 (20260904125200_mig_prov_r1_key_safety_hardening_b_apply_bounded_mirror_keys) backfills, makes them
--          NOT NULL, adds trusted CHECKs, and rebuilds keys/indexes on the mirrors.
-- Rationale: SQL Server compiles a Prisma migration batch as one unit; same-batch references to newly added columns
--            raise error 207. Adding columns first (pure DDL, no column reference) avoids the issue and matches the
--            constitution's phased nullable-structure-first approach.

-- 1. spare_part_condition_balances mirrors (nullable; backfilled in phase 2)
IF EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('spare_part_condition_balances'))
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('spare_part_condition_balances') AND name = 'spare_part_key')
        ALTER TABLE spare_part_condition_balances ADD spare_part_key NVARCHAR(200) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('spare_part_condition_balances') AND name = 'warehouse_key')
        ALTER TABLE spare_part_condition_balances ADD warehouse_key NVARCHAR(200) NULL;
END;

-- 2. maintenance_sla_states mirror (nullable; backfilled in phase 2)
IF EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('maintenance_sla_states'))
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_sla_states') AND name = 'maintenance_request_key')
        ALTER TABLE maintenance_sla_states ADD maintenance_request_key NVARCHAR(200) NULL;
END;