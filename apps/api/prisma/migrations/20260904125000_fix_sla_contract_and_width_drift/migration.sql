-- Migration: fix_sla_contract_and_width_drift
-- Purpose: Reconcile SLA ORM→DB contract (snake_case @map), fix spare-part width drift,
--          normalize downtime_logs widths, and retire orphan camelCase SLA columns.
-- Safety: All operations idempotent (IF-guarded). Data-safe: orphan columns verified
--         100% NULL or exact duplicate of snake equivalents. Empty/small tables for width changes.
-- Slot: BETWEEN 20260904120000_cost_r2c_external_service_ledger AND 20260904130000_cost_r2d_b1

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. MAINTENANCE_REQUESTS — Drop 6 orphan camelCase SLA columns
--    Data proof: all NULL or exact match of snake equivalent (empirically verified).
--    ORM uses @map("snake_case") → these columns are never referenced.
-- ══════════════════════════════════════════════════════════════════════════════
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'responseDueAt')
    ALTER TABLE maintenance_requests DROP COLUMN responseDueAt;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'startDueAt')
    ALTER TABLE maintenance_requests DROP COLUMN startDueAt;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'completeDueAt')
    ALTER TABLE maintenance_requests DROP COLUMN completeDueAt;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'slaStatus')
    ALTER TABLE maintenance_requests DROP COLUMN slaStatus;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'escalationLevel')
    ALTER TABLE maintenance_requests DROP COLUMN escalationLevel;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_requests') AND name = 'lastEscalatedAt')
    ALTER TABLE maintenance_requests DROP COLUMN lastEscalatedAt;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. MAINTENANCE_REQUESTS — Add 4 SLA indexes (matching golden canonical)
-- ══════════════════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_requests_sla_status' AND object_id = OBJECT_ID('maintenance_requests'))
    CREATE NONCLUSTERED INDEX idx_maintenance_requests_sla_status ON maintenance_requests(sla_status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_requests_escalation_level' AND object_id = OBJECT_ID('maintenance_requests'))
    CREATE NONCLUSTERED INDEX idx_maintenance_requests_escalation_level ON maintenance_requests(escalation_level);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_requests_response_due_at' AND object_id = OBJECT_ID('maintenance_requests'))
    CREATE NONCLUSTERED INDEX idx_maintenance_requests_response_due_at ON maintenance_requests(response_due_at);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_requests_complete_due_at' AND object_id = OBJECT_ID('maintenance_requests'))
    CREATE NONCLUSTERED INDEX idx_maintenance_requests_complete_due_at ON maintenance_requests(complete_due_at);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. MAINTENANCE_SLA_RULES — Widen id/name to NVARCHAR(1000), recreate PK, add 3 indexes
--    Table is empty in production. Golden has NVARCHAR(1000).
-- ══════════════════════════════════════════════════════════════════════════════
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_sla_rules') AND name = 'id' AND max_length = 510)
BEGIN
    -- Drop existing PK (auto-generated name varies per environment)
    DECLARE @sla_rules_pk NVARCHAR(128) = (
        SELECT name FROM sys.indexes
        WHERE object_id = OBJECT_ID('maintenance_sla_rules')
          AND is_primary_key = 1 AND type_desc = 'CLUSTERED'
    );
    IF @sla_rules_pk IS NOT NULL
    BEGIN
        DECLARE @sla_idx_sql NVARCHAR(4000) = N'ALTER TABLE maintenance_sla_rules DROP CONSTRAINT ' + QUOTENAME(@sla_rules_pk);
        EXEC sp_executesql @sla_idx_sql;
    END;

    ALTER TABLE maintenance_sla_rules ALTER COLUMN id NVARCHAR(1000) NOT NULL;
    ALTER TABLE maintenance_sla_rules ALTER COLUMN name NVARCHAR(1000) NOT NULL;

    -- Recreate PK with same name
    IF @sla_rules_pk IS NOT NULL
    BEGIN
        DECLARE @sla_pk_sql NVARCHAR(4000) = N'ALTER TABLE maintenance_sla_rules ADD CONSTRAINT ' + QUOTENAME(@sla_rules_pk) + ' PRIMARY KEY CLUSTERED (id)';
        EXEC sp_executesql @sla_pk_sql;
    END
    ELSE
        ALTER TABLE maintenance_sla_rules ADD CONSTRAINT PK_maintenance_sla_rules PRIMARY KEY CLUSTERED (id);
END;

-- Add secondary indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_rules_priority' AND object_id = OBJECT_ID('maintenance_sla_rules'))
    CREATE NONCLUSTERED INDEX idx_maintenance_sla_rules_priority ON maintenance_sla_rules(priority);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_rules_type' AND object_id = OBJECT_ID('maintenance_sla_rules'))
    CREATE NONCLUSTERED INDEX idx_maintenance_sla_rules_type ON maintenance_sla_rules(type);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_rules_is_active' AND object_id = OBJECT_ID('maintenance_sla_rules'))
    CREATE NONCLUSTERED INDEX idx_maintenance_sla_rules_is_active ON maintenance_sla_rules(is_active);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. MAINTENANCE_SLA_STATES — Add FK + unique index + 2 secondary indexes
--    production already has id/maintenance_request_id as NVARCHAR(1000).
--    Golden has FK_maintenance_sla_states_request + unique idx on request_id.
-- ══════════════════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_maintenance_sla_states_request' AND parent_object_id = OBJECT_ID('maintenance_sla_states'))
    ALTER TABLE maintenance_sla_states ADD CONSTRAINT FK_maintenance_sla_states_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_states_request' AND object_id = OBJECT_ID('maintenance_sla_states'))
    CREATE UNIQUE NONCLUSTERED INDEX idx_maintenance_sla_states_request ON maintenance_sla_states(maintenance_request_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_states_sla_status' AND object_id = OBJECT_ID('maintenance_sla_states'))
    CREATE NONCLUSTERED INDEX idx_maintenance_sla_states_sla_status ON maintenance_sla_states(sla_status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_sla_states_escalation_level' AND object_id = OBJECT_ID('maintenance_sla_states'))
    CREATE NONCLUSTERED INDEX idx_maintenance_sla_states_escalation_level ON maintenance_sla_states(escalation_level);


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. SPARE_PART_CONDITION_BALANCES — Widen ID/FK columns to NVARCHAR(1000),
--    recreate PK/UQ/indexes to match golden canonical.
--    Table has 2 rows in production; widening only (255→1000), no data truncation.
-- ══════════════════════════════════════════════════════════════════════════════
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('spare_part_condition_balances') AND name IN ('id','sparePartId','productId','warehouseId') AND max_length = 510)
BEGIN
    -- Drop existing PK (any name)
    DECLARE @scb_pk NVARCHAR(128) = (
        SELECT name FROM sys.indexes
        WHERE object_id = OBJECT_ID('spare_part_condition_balances')
          AND is_primary_key = 1
    );
    IF @scb_pk IS NOT NULL
    BEGIN
        DECLARE @scb_pk_sql NVARCHAR(4000) = N'ALTER TABLE spare_part_condition_balances DROP CONSTRAINT ' + QUOTENAME(@scb_pk);
        EXEC sp_executesql @scb_pk_sql;
    END;

    -- Drop existing UQ composite (created as UNIQUE CONSTRAINt in golden + production)
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_spare_part_condition_balances' AND object_id = OBJECT_ID('spare_part_condition_balances') AND is_unique_constraint = 1)
        ALTER TABLE spare_part_condition_balances DROP CONSTRAINT UQ_spare_part_condition_balances;
    ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_spare_part_condition_balances' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        DROP INDEX UQ_spare_part_condition_balances ON spare_part_condition_balances;

    -- Drop production-named secondary indexes (will recreate with golden names)
    DROP INDEX IF EXISTS IX_spare_part_condition_balances_id ON spare_part_condition_balances;
    DROP INDEX IF EXISTS IX_spare_part_condition_balances_productId ON spare_part_condition_balances;
    DROP INDEX IF EXISTS IX_spare_part_condition_balances_sparePartId ON spare_part_condition_balances;
    DROP INDEX IF EXISTS IX_spare_part_condition_balances_warehouseId ON spare_part_condition_balances;
    DROP INDEX IF EXISTS IX_spare_part_condition_balances_condition ON spare_part_condition_balances;
    DROP INDEX IF EXISTS IX_spare_part_condition_balances_lastMovementAt ON spare_part_condition_balances;

    -- Widen columns (widening is safe: 255→1000 chars, data is cuid strings ~25 chars)
    ALTER TABLE spare_part_condition_balances ALTER COLUMN id NVARCHAR(1000) NOT NULL;
    ALTER TABLE spare_part_condition_balances ALTER COLUMN sparePartId NVARCHAR(1000) NOT NULL;
    ALTER TABLE spare_part_condition_balances ALTER COLUMN productId NVARCHAR(1000) NULL;
    ALTER TABLE spare_part_condition_balances ALTER COLUMN warehouseId NVARCHAR(1000) NOT NULL;

    -- Recreate PK with golden canonical name (idempotent)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'PK_spare_part_condition_balances' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        ALTER TABLE spare_part_condition_balances ADD CONSTRAINT PK_spare_part_condition_balances PRIMARY KEY CLUSTERED (id);

    -- Recreate unique composite (total key ~4100 bytes: SQL Server permits with warning, not error)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_spare_part_condition_balances' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE UNIQUE NONCLUSTERED INDEX UQ_spare_part_condition_balances ON spare_part_condition_balances(sparePartId, warehouseId, condition);

    -- Recreate secondary indexes with golden canonical names (idempotent)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_productId' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_productId ON spare_part_condition_balances(productId);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_sparePartId' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_sparePartId ON spare_part_condition_balances(sparePartId);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_warehouseId' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_warehouseId ON spare_part_condition_balances(warehouseId);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_condition' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_condition ON spare_part_condition_balances(condition);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_scb_lastMovementAt' AND object_id = OBJECT_ID('spare_part_condition_balances'))
        CREATE NONCLUSTERED INDEX IX_scb_lastMovementAt ON spare_part_condition_balances(lastMovementAt);
END;


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. DOWNTIME_LOGS — Reconcile 6 columns to golden canonical widths
--    Table is empty (0 rows). No indexes depend on these columns.
--    Widening and narrowing both data-safe.
-- ══════════════════════════════════════════════════════════════════════════════
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('downtime_logs') AND name = 'failureCategory' AND max_length = 2000)
    ALTER TABLE downtime_logs ALTER COLUMN failureCategory NVARCHAR(200);

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('downtime_logs') AND name = 'rootCause' AND max_length = 2000)
    ALTER TABLE downtime_logs ALTER COLUMN rootCause NVARCHAR(4000);

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('downtime_logs') AND name = 'correctiveAction' AND max_length = 2000)
    ALTER TABLE downtime_logs ALTER COLUMN correctiveAction NVARCHAR(4000);

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('downtime_logs') AND name = 'preventiveAction' AND max_length = 2000)
    ALTER TABLE downtime_logs ALTER COLUMN preventiveAction NVARCHAR(4000);

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('downtime_logs') AND name = 'repeatedFailureGroupId' AND max_length = 2000)
    ALTER TABLE downtime_logs ALTER COLUMN repeatedFailureGroupId NVARCHAR(200);

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('downtime_logs') AND name = 'rcaStatus' AND max_length = 2000)
    ALTER TABLE downtime_logs ALTER COLUMN rcaStatus NVARCHAR(100);


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. MAINTENANCE_REQUEST_REQUIRED_PARTS — Widen reason to NVARCHAR(MAX)
--    Golden has NVARCHAR(MAX). Production has NVARCHAR(2000). Widening is safe.
-- ══════════════════════════════════════════════════════════════════════════════
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'reason' AND max_length != -1)
    ALTER TABLE maintenance_request_required_parts ALTER COLUMN reason NVARCHAR(MAX);
