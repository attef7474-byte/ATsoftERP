-- Migration: mig_prov_r1_key_safety_hardening_b_apply_bounded_mirror_keys (ID-KEY-SAFE-R1 final package, phase 2 of 2)
-- Slot: BETWEEN 20260904125000_fix_sla_contract_and_width_drift AND B1 (20260904130000_cost_r2d_b1_overhead_source_period_foundation)
-- Phase 2: uses mirror columns added by 20260904125100_mig_prov_r1_key_safety_hardening_a_add_bounded_mirror_columns
--          (already exist -> same-batch bind is safe).
--   * backfill mirrors from sources (exact copy; no truncation because source LEN bounded by trusted CHECKs below)
--   * make mirrors NOT NULL
--   * trusted CHECK constraints: source LEN <= 200 AND mirror = source (exact equality).
--   * drop the 8 unsafe index/key objects; recreate uniqueness/performance indexes on bounded mirrors.
--   * narrow non-FK key columns (scb.id, scb.productId, sla rule/state ids) locally.
--   * converge production SCB divergence by adding canonical FKs IF NOT EXISTS.
-- History remains immutable; fresh replay ends at this state with safe widths and no 1753.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. SPARE_PART_CONDITION_BALANCES
-- ══════════════════════════════════════════════════════════════════════════════
IF EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('spare_part_condition_balances'))
BEGIN
    -- 1.1 Backfill mirrors (exact copy of source values)
    UPDATE spare_part_condition_balances
       SET spare_part_key = sparePartId,
           warehouse_key = warehouseId
     WHERE spare_part_key IS NULL OR warehouse_key IS NULL;

    -- 1.2 Not null
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('spare_part_condition_balances') AND name = 'spare_part_key' AND is_nullable = 1)
        ALTER TABLE spare_part_condition_balances ALTER COLUMN spare_part_key NVARCHAR(200) NOT NULL;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('spare_part_condition_balances') AND name = 'warehouse_key' AND is_nullable = 1)
        ALTER TABLE spare_part_condition_balances ALTER COLUMN warehouse_key NVARCHAR(200) NOT NULL;

    -- 1.3 Trusted CHECKs (added WITH NOCHECK off -> value check enforced on insert/update, trusted): bounds + exact equality
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_scb_spare_part_id_len' AND parent_object_id = OBJECT_ID('spare_part_condition_balances'))
        ALTER TABLE spare_part_condition_balances ADD CONSTRAINT chk_scb_spare_part_id_len CHECK (LEN(sparePartId) <= 200);
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_scb_warehouse_id_len' AND parent_object_id = OBJECT_ID('spare_part_condition_balances'))
        ALTER TABLE spare_part_condition_balances ADD CONSTRAINT chk_scb_warehouse_id_len CHECK (LEN(warehouseId) <= 200);
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_scb_spare_key_eq' AND parent_object_id = OBJECT_ID('spare_part_condition_balances'))
        ALTER TABLE spare_part_condition_balances ADD CONSTRAINT chk_scb_spare_key_eq CHECK (spare_part_key = sparePartId);
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_scb_warehouse_key_eq' AND parent_object_id = OBJECT_ID('spare_part_condition_balances'))
        ALTER TABLE spare_part_condition_balances ADD CONSTRAINT chk_scb_warehouse_key_eq CHECK (warehouse_key = warehouseId);

    -- 1.4 Drop unsafe wide key/index objects (both shape variants: unique constraint on canonical replay, unique index on production)
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_spare_part_condition_balances' AND object_id = OBJECT_ID('spare_part_condition_balances') AND is_unique_constraint = 1)
        ALTER TABLE spare_part_condition_balances DROP CONSTRAINT UQ_spare_part_condition_balances;
    ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_spare_part_condition_balances' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        DROP INDEX UQ_spare_part_condition_balances ON spare_part_condition_balances;

    DROP INDEX IF EXISTS IX_scb_sparePartId ON spare_part_condition_balances;
    DROP INDEX IF EXISTS IX_scb_warehouseId ON spare_part_condition_balances;
    DROP INDEX IF EXISTS IX_scb_productId ON spare_part_condition_balances;
    DROP INDEX IF EXISTS IX_scb_condition ON spare_part_condition_balances;
    DROP INDEX IF EXISTS IX_scb_lastMovementAt ON spare_part_condition_balances;

    -- 1.5 Narrow non-FK key columns: id (clustered PK, no incoming FKs) and productId (not an FK column).
    DECLARE @scb_pk NVARCHAR(128) = (
        SELECT name FROM sys.indexes
        WHERE object_id = OBJECT_ID('spare_part_condition_balances')
          AND is_primary_key = 1 AND type_desc = 'CLUSTERED'
    );
    IF @scb_pk IS NOT NULL
    BEGIN
        DECLARE @scb_pk_sql NVARCHAR(4000) = N'ALTER TABLE spare_part_condition_balances DROP CONSTRAINT ' + QUOTENAME(@scb_pk);
        EXEC sp_executesql @scb_pk_sql;
    END;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('spare_part_condition_balances') AND name = 'id' AND max_length = 2000)
        ALTER TABLE spare_part_condition_balances ALTER COLUMN id NVARCHAR(200) NOT NULL;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('spare_part_condition_balances') AND name = 'productId' AND max_length = 2000)
        ALTER TABLE spare_part_condition_balances ALTER COLUMN productId NVARCHAR(200) NULL;

    -- 1.6 Recreate PK on narrowed id (400 bytes clustered, safe <= 900)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'PK_spare_part_condition_balances' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        ALTER TABLE spare_part_condition_balances ADD CONSTRAINT PK_spare_part_condition_balances PRIMARY KEY CLUSTERED (id);

    -- 1.7 Uniqueness + performance indexes on BOUNDED MIRRORS (200+200+50 chars = 900 bytes, safe <= 1700)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_spare_part_condition_balances' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE UNIQUE NONCLUSTERED INDEX UQ_spare_part_condition_balances ON spare_part_condition_balances(spare_part_key, warehouse_key, condition);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_sparePartKey' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_sparePartKey ON spare_part_condition_balances(spare_part_key);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_warehouseKey' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_warehouseKey ON spare_part_condition_balances(warehouse_key);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_productId' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_productId ON spare_part_condition_balances(productId);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_condition' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_condition ON spare_part_condition_balances(condition);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_lastMovementAt' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_lastMovementAt ON spare_part_condition_balances(lastMovementAt);

    -- 1.8 Converge production divergence: add canonical FKs if absent (0 orphan rows verified in production).
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_scb_sparePart' AND parent_object_id = OBJECT_ID('spare_part_condition_balances'))
        ALTER TABLE spare_part_condition_balances ADD CONSTRAINT FK_scb_sparePart FOREIGN KEY (sparePartId) REFERENCES spare_parts(id);

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_scb_warehouse' AND parent_object_id = OBJECT_ID('spare_part_condition_balances'))
        ALTER TABLE spare_part_condition_balances ADD CONSTRAINT FK_scb_warehouse FOREIGN KEY (warehouseId) REFERENCES warehouses(id);
END;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. MAINTENANCE_SLA_RULES - narrow id (clustered PK; empty table; no incoming FKs)
-- ══════════════════════════════════════════════════════════════════════════════
IF EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('maintenance_sla_rules'))
BEGIN
    DROP INDEX IF EXISTS idx_maintenance_sla_rules_priority ON maintenance_sla_rules;
    DROP INDEX IF EXISTS idx_maintenance_sla_rules_type ON maintenance_sla_rules;
    DROP INDEX IF EXISTS idx_maintenance_sla_rules_is_active ON maintenance_sla_rules;

    DECLARE @sla_rules_pk NVARCHAR(128) = (
        SELECT name FROM sys.indexes
        WHERE object_id = OBJECT_ID('maintenance_sla_rules')
          AND is_primary_key = 1 AND type_desc = 'CLUSTERED'
    );
    IF @sla_rules_pk IS NOT NULL
    BEGIN
        DECLARE @sla_rules_pk_sql NVARCHAR(4000) = N'ALTER TABLE maintenance_sla_rules DROP CONSTRAINT ' + QUOTENAME(@sla_rules_pk);
        EXEC sp_executesql @sla_rules_pk_sql;
    END;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_sla_rules') AND name = 'id' AND max_length = 2000)
        ALTER TABLE maintenance_sla_rules ALTER COLUMN id NVARCHAR(200) NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'PK_maintenance_sla_rules' AND object_id = OBJECT_ID('maintenance_sla_rules'))
        ALTER TABLE maintenance_sla_rules ADD CONSTRAINT PK_maintenance_sla_rules PRIMARY KEY CLUSTERED (id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_rules_priority' AND object_id = OBJECT_ID('maintenance_sla_rules'))
        CREATE NONCLUSTERED INDEX idx_maintenance_sla_rules_priority ON maintenance_sla_rules(priority);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_rules_type' AND object_id = OBJECT_ID('maintenance_sla_rules'))
        CREATE NONCLUSTERED INDEX idx_maintenance_sla_rules_type ON maintenance_sla_rules(type);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_rules_is_active' AND object_id = OBJECT_ID('maintenance_sla_rules'))
        CREATE NONCLUSTERED INDEX idx_maintenance_sla_rules_is_active ON maintenance_sla_rules(is_active);
END;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. MAINTENANCE_SLA_STATES - narrow id; 1:1 uniqueness moves to bounded mirror
--    maintenance_request_id stays NVARCHAR(1000) (FK partner of maintenance_requests.id).
-- ══════════════════════════════════════════════════════════════════════════════
IF EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('maintenance_sla_states'))
BEGIN
    UPDATE maintenance_sla_states
       SET maintenance_request_key = maintenance_request_id
     WHERE maintenance_request_key IS NULL;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_sla_states') AND name = 'maintenance_request_key' AND is_nullable = 1)
        ALTER TABLE maintenance_sla_states ALTER COLUMN maintenance_request_key NVARCHAR(200) NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_sla_states_request_id_len' AND parent_object_id = OBJECT_ID('maintenance_sla_states'))
        ALTER TABLE maintenance_sla_states ADD CONSTRAINT chk_sla_states_request_id_len CHECK (LEN(maintenance_request_id) <= 200);
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_sla_states_request_key_eq' AND parent_object_id = OBJECT_ID('maintenance_sla_states'))
        ALTER TABLE maintenance_sla_states ADD CONSTRAINT chk_sla_states_request_key_eq CHECK (maintenance_request_key = maintenance_request_id);

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_states_request' AND object_id = OBJECT_ID('maintenance_sla_states'))
        DROP INDEX idx_maintenance_sla_states_request ON maintenance_sla_states;

    DROP INDEX IF EXISTS idx_maintenance_sla_states_sla_status ON maintenance_sla_states;
    DROP INDEX IF EXISTS idx_maintenance_sla_states_escalation_level ON maintenance_sla_states;

    DECLARE @sla_states_pk NVARCHAR(128) = (
        SELECT name FROM sys.indexes
        WHERE object_id = OBJECT_ID('maintenance_sla_states')
          AND is_primary_key = 1 AND type_desc = 'CLUSTERED'
    );
    IF @sla_states_pk IS NOT NULL
    BEGIN
        DECLARE @sla_states_pk_sql NVARCHAR(4000) = N'ALTER TABLE maintenance_sla_states DROP CONSTRAINT ' + QUOTENAME(@sla_states_pk);
        EXEC sp_executesql @sla_states_pk_sql;
    END;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_sla_states') AND name = 'id' AND max_length = 2000)
        ALTER TABLE maintenance_sla_states ALTER COLUMN id NVARCHAR(200) NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'PK_maintenance_sla_states' AND object_id = OBJECT_ID('maintenance_sla_states'))
        ALTER TABLE maintenance_sla_states ADD CONSTRAINT PK_maintenance_sla_states PRIMARY KEY CLUSTERED (id);

    -- 1:1 SLA exact enforcement: unique index on bounded mirror (400 bytes, safe <= 1700)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_states_request_key' AND object_id = OBJECT_ID('maintenance_sla_states'))
        CREATE UNIQUE NONCLUSTERED INDEX idx_maintenance_sla_states_request_key ON maintenance_sla_states(maintenance_request_key);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_states_sla_status' AND object_id = OBJECT_ID('maintenance_sla_states'))
        CREATE NONCLUSTERED INDEX idx_maintenance_sla_states_sla_status ON maintenance_sla_states(sla_status);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_states_escalation_level' AND object_id = OBJECT_ID('maintenance_sla_states'))
        CREATE NONCLUSTERED INDEX idx_maintenance_sla_states_escalation_level ON maintenance_sla_states(escalation_level);
END;