-- ============================================================================
-- Baseline: installed parts, replacement history, repairable spare parts,
-- maintenance BOM versioning, preventive spare-part planning, and spare-part
-- condition balance/movement tables.
--
-- PURPOSE
--   These tables were historically created by loose root-level SQL scripts
--   (abac_installed_parts_replacement_history.sql, adae_repairable_spareparts_overhaul.sql,
--   ahai_bom_versioning_preventive_spareparts_planning.sql, zaa_add_sparepart_condition_balance.sql)
--   that `prisma migrate deploy` never executes. A fresh database therefore failed
--   at 20260801120000_ux1b2c_expected_life_checklist_snapshot because
--   machine_installed_parts did not exist.
--
--   This migration makes the Prisma chain fully self-contained: every table
--   declared in schema.prisma is now created by a dated migration, in the exact
--   shape produced by the original scripts (verified identical to the live DB).
--
-- SAFETY
--   Idempotent: each table is created only if it does not already exist, so this
--   is a no-op on databases where the tables already exist (e.g. the live DB
--   that was built with the loose scripts). No existing rows, indexes, or
--   constraints are touched. GO batch separators from the original scripts are
--   removed because Prisma executes each migration as a single batch.
-- ============================================================================

PRINT 'Applying baseline 20260731000000 (installed parts, replacement, repair, BOM, condition tables)...';

-- ── AB-AC: Installed Parts Register + Replacement History ──────────────────

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'machine_installed_parts')
BEGIN
    CREATE TABLE machine_installed_parts (
        id                      NVARCHAR(1000)  NOT NULL PRIMARY KEY,
        machine_id              NVARCHAR(1000)  NOT NULL,
        machine_component_id    NVARCHAR(1000)  NULL,
        spare_part_id           NVARCHAR(1000)  NOT NULL,
        product_id              NVARCHAR(1000)  NULL,
        maintenance_request_id  NVARCHAR(1000)  NULL,
        required_part_id        NVARCHAR(1000)  NULL,
        inventory_movement_id   NVARCHAR(1000)  NULL,
        condition_movement_id   NVARCHAR(1000)  NULL,
        installed_quantity      FLOAT           NOT NULL,
        installed_condition     NVARCHAR(50)    NOT NULL DEFAULT 'NEW',
        installed_at            DATETIME2       NOT NULL DEFAULT GETDATE(),
        installed_by_user_id    NVARCHAR(1000)  NULL,
        source_type             NVARCHAR(50)    NULL,
        source_id               NVARCHAR(1000)  NULL,
        serial_number           NVARCHAR(255)   NULL,
        batch_number            NVARCHAR(255)   NULL,
        status                  NVARCHAR(50)    NOT NULL DEFAULT 'ACTIVE',
        removed_at              DATETIME2       NULL,
        removed_by_user_id      NVARCHAR(1000)  NULL,
        removed_condition       NVARCHAR(50)    NULL,
        removed_quantity        FLOAT           NULL,
        removed_reason          NVARCHAR(MAX)   NULL,
        notes                   NVARCHAR(MAX)   NULL,
        created_at              DATETIME2       NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2       NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX idx_mip_machine ON machine_installed_parts(machine_id);
    CREATE INDEX idx_mip_component ON machine_installed_parts(machine_component_id);
    CREATE INDEX idx_mip_spare_part ON machine_installed_parts(spare_part_id);
    CREATE INDEX idx_mip_request ON machine_installed_parts(maintenance_request_id);
    CREATE INDEX idx_mip_required_part ON machine_installed_parts(required_part_id);
    CREATE INDEX idx_mip_status ON machine_installed_parts(status);
    CREATE INDEX idx_mip_installed_at ON machine_installed_parts(installed_at);
END;

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'spare_part_replacement_histories')
BEGIN
    CREATE TABLE spare_part_replacement_histories (
        id                          NVARCHAR(1000)  NOT NULL PRIMARY KEY,
        replacement_number          NVARCHAR(255)   NOT NULL UNIQUE,
        machine_id                  NVARCHAR(1000)  NOT NULL,
        machine_component_id        NVARCHAR(1000)  NULL,
        maintenance_request_id      NVARCHAR(1000)  NULL,
        required_part_id            NVARCHAR(1000)  NULL,
        old_installed_part_id       NVARCHAR(1000)  NULL,
        new_installed_part_id       NVARCHAR(1000)  NULL,
        old_spare_part_id           NVARCHAR(1000)  NULL,
        new_spare_part_id           NVARCHAR(1000)  NOT NULL,
        issued_condition            NVARCHAR(50)    NOT NULL,
        issued_quantity             FLOAT           NOT NULL,
        removed_condition           NVARCHAR(50)    NULL,
        removed_quantity            FLOAT           NULL,
        replacement_action          NVARCHAR(50)    NOT NULL,
        no_return_reason            NVARCHAR(MAX)   NULL,
        removed_returned_to_stock   BIT             NOT NULL DEFAULT 0,
        condition_out_movement_id   NVARCHAR(1000)  NULL,
        condition_in_movement_id    NVARCHAR(1000)  NULL,
        inventory_out_movement_id   NVARCHAR(1000)  NULL,
        replaced_at                 DATETIME2       NOT NULL DEFAULT GETDATE(),
        replaced_by_user_id         NVARCHAR(1000)  NULL,
        notes                       NVARCHAR(MAX)   NULL,
        created_at                  DATETIME2       NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX idx_sprh_machine ON spare_part_replacement_histories(machine_id);
    CREATE INDEX idx_sprh_component ON spare_part_replacement_histories(machine_component_id);
    CREATE INDEX idx_sprh_request ON spare_part_replacement_histories(maintenance_request_id);
    CREATE INDEX idx_sprh_required_part ON spare_part_replacement_histories(required_part_id);
    CREATE INDEX idx_sprh_old_installed ON spare_part_replacement_histories(old_installed_part_id);
    CREATE INDEX idx_sprh_new_installed ON spare_part_replacement_histories(new_installed_part_id);
    CREATE INDEX idx_sprh_replaced_at ON spare_part_replacement_histories(replaced_at);
END;

-- ── AD-AE: Repairable Spare Parts Workflow + Overhaul ──────────────────────

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'spare_part_repair_orders')
BEGIN
    CREATE TABLE spare_part_repair_orders (
        id                          NVARCHAR(50)   NOT NULL PRIMARY KEY,
        repair_order_number         NVARCHAR(50)   NULL,
        spare_part_id               NVARCHAR(50)   NOT NULL,
        product_id                  NVARCHAR(50)   NULL,
        warehouse_id                NVARCHAR(50)   NOT NULL,
        source_condition            NVARCHAR(50)   NOT NULL,
        source_quantity             FLOAT          NOT NULL DEFAULT 0,
        reserved_quantity           FLOAT          NOT NULL DEFAULT 0,
        repaired_quantity           FLOAT          NOT NULL DEFAULT 0,
        scrapped_quantity           FLOAT          NOT NULL DEFAULT 0,
        remaining_quantity          FLOAT          NOT NULL DEFAULT 0,
        target_condition            NVARCHAR(50)   NULL,
        status                      NVARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
        source_type                 NVARCHAR(50)   NULL,
        source_id                   NVARCHAR(50)   NULL,
        maintenance_request_id      NVARCHAR(50)   NULL,
        required_part_id            NVARCHAR(50)   NULL,
        replacement_history_id      NVARCHAR(50)   NULL,
        installed_part_id           NVARCHAR(50)   NULL,
        condition_in_movement_id    NVARCHAR(50)   NULL,
        condition_out_movement_id   NVARCHAR(50)   NULL,
        inventory_scrap_movement_id NVARCHAR(50)   NULL,
        machine_id                  NVARCHAR(50)   NULL,
        machine_component_id        NVARCHAR(50)   NULL,
        inspection_result           NVARCHAR(500)  NULL,
        failure_description         NVARCHAR(1000) NULL,
        repair_description          NVARCHAR(1000) NULL,
        test_result                 NVARCHAR(500)  NULL,
        test_notes                  NVARCHAR(500)  NULL,
        external_repair             BIT            NOT NULL DEFAULT 0,
        external_repair_provider_name NVARCHAR(200) NULL,
        estimated_repair_cost       DECIMAL(18,2)  NULL,
        actual_repair_cost          DECIMAL(18,2)  NULL,
        opened_by_user_id           NVARCHAR(50)   NULL,
        inspected_by_user_id        NVARCHAR(50)   NULL,
        repaired_by_user_id         NVARCHAR(50)   NULL,
        tested_by_user_id           NVARCHAR(50)   NULL,
        closed_by_user_id           NVARCHAR(50)   NULL,
        opened_at                   DATETIME2      NOT NULL DEFAULT GETDATE(),
        inspection_started_at       DATETIME2      NULL,
        repair_started_at           DATETIME2      NULL,
        test_started_at             DATETIME2      NULL,
        completed_at                DATETIME2      NULL,
        cancelled_at                DATETIME2      NULL,
        cancel_reason               NVARCHAR(500)  NULL,
        notes                       NVARCHAR(1000) NULL,
        created_at                  DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at                  DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT uq_repair_order_number UNIQUE (repair_order_number)
    );

    CREATE INDEX idx_ro_spare_part_id ON spare_part_repair_orders(spare_part_id);
    CREATE INDEX idx_ro_product_id ON spare_part_repair_orders(product_id);
    CREATE INDEX idx_ro_warehouse_id ON spare_part_repair_orders(warehouse_id);
    CREATE INDEX idx_ro_status ON spare_part_repair_orders(status);
    CREATE INDEX idx_ro_source_condition ON spare_part_repair_orders(source_condition);
    CREATE INDEX idx_ro_target_condition ON spare_part_repair_orders(target_condition);
    CREATE INDEX idx_ro_maintenance_request_id ON spare_part_repair_orders(maintenance_request_id);
    CREATE INDEX idx_ro_required_part_id ON spare_part_repair_orders(required_part_id);
    CREATE INDEX idx_ro_replacement_history_id ON spare_part_repair_orders(replacement_history_id);
    CREATE INDEX idx_ro_condition_in_movement_id ON spare_part_repair_orders(condition_in_movement_id);
    CREATE INDEX idx_ro_machine_id ON spare_part_repair_orders(machine_id);
    CREATE INDEX idx_ro_machine_component_id ON spare_part_repair_orders(machine_component_id);
    CREATE INDEX idx_ro_opened_at ON spare_part_repair_orders(opened_at);
    CREATE INDEX idx_ro_completed_at ON spare_part_repair_orders(completed_at);
    CREATE INDEX idx_ro_source_type_source_id ON spare_part_repair_orders(source_type, source_id);
END;

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'spare_part_repair_actions')
BEGIN
    CREATE TABLE spare_part_repair_actions (
        id                  NVARCHAR(50)   NOT NULL PRIMARY KEY,
        repair_order_id     NVARCHAR(50)   NOT NULL,
        action_type         NVARCHAR(50)   NOT NULL,
        action_status       NVARCHAR(50)   NOT NULL DEFAULT 'PLANNED',
        description         NVARCHAR(1000) NULL,
        result              NVARCHAR(500)  NULL,
        performed_by_user_id NVARCHAR(50)  NULL,
        performed_at        DATETIME2      NULL,
        duration_minutes    INT            NULL,
        notes               NVARCHAR(500)  NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT fk_repair_action_order FOREIGN KEY (repair_order_id) REFERENCES spare_part_repair_orders(id)
    );

    CREATE INDEX idx_ra_repair_order_id ON spare_part_repair_actions(repair_order_id);
    CREATE INDEX idx_ra_action_type ON spare_part_repair_actions(action_type);
    CREATE INDEX idx_ra_action_status ON spare_part_repair_actions(action_status);
    CREATE INDEX idx_ra_performed_at ON spare_part_repair_actions(performed_at);
END;

-- ── AH-AI: BOM Versioning + Preventive Spare Parts Planning ────────────────

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'maintenance_boms')
BEGIN
    CREATE TABLE maintenance_boms (
        id           NVARCHAR(1000) NOT NULL PRIMARY KEY,
        code         NVARCHAR(255) NOT NULL,
        name         NVARCHAR(255) NOT NULL,
        description  NVARCHAR(MAX) NULL,
        machineId    NVARCHAR(1000) NULL,
        componentId  NVARCHAR(1000) NULL,
        status       NVARCHAR(50)   NOT NULL DEFAULT 'ACTIVE',
        createdAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
        deletedAt    DATETIME2     NULL,

        CONSTRAINT UQ_maintenance_boms_code UNIQUE (code),
        CONSTRAINT FK_maintenance_boms_machine FOREIGN KEY (machineId) REFERENCES machines(id) ON DELETE NO ACTION,
        CONSTRAINT FK_maintenance_boms_component FOREIGN KEY (componentId) REFERENCES machine_components(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_maintenance_boms_machineId ON maintenance_boms(machineId);
    CREATE INDEX IX_maintenance_boms_componentId ON maintenance_boms(componentId);
    CREATE INDEX IX_maintenance_boms_status ON maintenance_boms(status);
    CREATE INDEX IX_maintenance_boms_code ON maintenance_boms(code);
END;

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'maintenance_bom_versions')
BEGIN
    CREATE TABLE maintenance_bom_versions (
        id             NVARCHAR(1000) NOT NULL PRIMARY KEY,
        bomId          NVARCHAR(1000) NOT NULL,
        versionNumber  INT            NOT NULL,
        versionLabel   NVARCHAR(255)  NOT NULL,
        description    NVARCHAR(MAX)  NULL,
        isActive       BIT            NOT NULL DEFAULT 0,
        effectiveDate  DATETIME2      NULL,
        createdById    NVARCHAR(1000) NULL,
        createdAt      DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt      DATETIME2     NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_bom_versions_bom FOREIGN KEY (bomId) REFERENCES maintenance_boms(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_bom_versions_bom_version UNIQUE (bomId, versionNumber),
        CONSTRAINT FK_bom_versions_createdBy FOREIGN KEY (createdById) REFERENCES users(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_bom_versions_bomId ON maintenance_bom_versions(bomId);
    CREATE INDEX IX_bom_versions_isActive ON maintenance_bom_versions(isActive);
    CREATE INDEX IX_bom_versions_bomId_isActive ON maintenance_bom_versions(bomId, isActive);
END;

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'maintenance_bom_items')
BEGIN
    CREATE TABLE maintenance_bom_items (
        id            NVARCHAR(1000) NOT NULL PRIMARY KEY,
        bomVersionId  NVARCHAR(1000) NOT NULL,
        sparePartId   NVARCHAR(1000) NOT NULL,
        quantity      FLOAT         NOT NULL,
        unit          NVARCHAR(50)  NULL,
        usageNote     NVARCHAR(MAX) NULL,
        isCritical    BIT           NOT NULL DEFAULT 0,
        sortOrder     INT           NOT NULL DEFAULT 0,
        createdAt     DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt     DATETIME2     NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_bom_items_version FOREIGN KEY (bomVersionId) REFERENCES maintenance_bom_versions(id) ON DELETE NO ACTION,
        CONSTRAINT FK_bom_items_sparePart FOREIGN KEY (sparePartId) REFERENCES spare_parts(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_bom_items_bomVersionId ON maintenance_bom_items(bomVersionId);
    CREATE INDEX IX_bom_items_sparePartId ON maintenance_bom_items(sparePartId);
END;

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'preventive_spare_part_plans')
BEGIN
    CREATE TABLE preventive_spare_part_plans (
        id            NVARCHAR(1000) NOT NULL PRIMARY KEY,
        planNumber    NVARCHAR(255)  NOT NULL,
        scheduleId    NVARCHAR(1000) NOT NULL,
        machineId     NVARCHAR(1000) NOT NULL,
        title         NVARCHAR(255)  NOT NULL,
        description   NVARCHAR(MAX)  NULL,
        status        NVARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
        generatedById NVARCHAR(1000) NULL,
        generatedAt   DATETIME2     NOT NULL DEFAULT GETDATE(),
        createdAt     DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt     DATETIME2     NOT NULL DEFAULT GETDATE(),

        CONSTRAINT UQ_spare_part_plans_planNumber UNIQUE (planNumber),
        CONSTRAINT FK_spare_part_plans_schedule FOREIGN KEY (scheduleId) REFERENCES maintenance_schedules(id) ON DELETE NO ACTION,
        CONSTRAINT FK_spare_part_plans_machine FOREIGN KEY (machineId) REFERENCES machines(id) ON DELETE NO ACTION,
        CONSTRAINT FK_spare_part_plans_generatedBy FOREIGN KEY (generatedById) REFERENCES users(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_spare_part_plans_scheduleId ON preventive_spare_part_plans(scheduleId);
    CREATE INDEX IX_spare_part_plans_machineId ON preventive_spare_part_plans(machineId);
    CREATE INDEX IX_spare_part_plans_status ON preventive_spare_part_plans(status);
    CREATE INDEX IX_spare_part_plans_planNumber ON preventive_spare_part_plans(planNumber);
END;

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'preventive_spare_part_plan_items')
BEGIN
    CREATE TABLE preventive_spare_part_plan_items (
        id                NVARCHAR(1000) NOT NULL PRIMARY KEY,
        planId            NVARCHAR(1000) NOT NULL,
        sparePartId       NVARCHAR(1000) NOT NULL,
        plannedQuantity   FLOAT          NOT NULL,
        availableQuantity FLOAT          NULL,
        condition         NVARCHAR(50)   NULL,
        unit              NVARCHAR(50)   NULL,
        isAvailable       BIT            NOT NULL DEFAULT 0,
        copyToRequestId   NVARCHAR(1000) NULL,
        notes             NVARCHAR(MAX) NULL,
        createdAt         DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt         DATETIME2     NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_plan_items_plan FOREIGN KEY (planId) REFERENCES preventive_spare_part_plans(id) ON DELETE NO ACTION,
        CONSTRAINT FK_plan_items_sparePart FOREIGN KEY (sparePartId) REFERENCES spare_parts(id) ON DELETE NO ACTION,
        CONSTRAINT FK_plan_items_copyToRequest FOREIGN KEY (copyToRequestId) REFERENCES maintenance_requests(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_plan_items_planId ON preventive_spare_part_plan_items(planId);
    CREATE INDEX IX_plan_items_sparePartId ON preventive_spare_part_plan_items(sparePartId);
    CREATE INDEX IX_plan_items_copyToRequestId ON preventive_spare_part_plan_items(copyToRequestId);
END;

-- ── Z-AA: Spare Part Condition Balance + Movement ──────────────────────────

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[spare_part_condition_balances]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[spare_part_condition_balances] (
        [id]                NVARCHAR(1000) NOT NULL,
        [sparePartId]       NVARCHAR(1000) NOT NULL,
        [productId]         NVARCHAR(1000) NULL,
        [warehouseId]       NVARCHAR(1000) NOT NULL,
        [condition]         NVARCHAR(50)   NOT NULL,
        [quantity]          FLOAT          NOT NULL DEFAULT 0,
        [availableQuantity] FLOAT          NOT NULL DEFAULT 0,
        [lastMovementAt]    DATETIME2      NULL,
        [createdAt]         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        [updatedAt]         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_spare_part_condition_balances] PRIMARY KEY ([id]),
        CONSTRAINT [UQ_spare_part_condition_balances] UNIQUE ([sparePartId], [warehouseId], [condition])
    );

    CREATE INDEX [IX_scb_sparePartId] ON [dbo].[spare_part_condition_balances] ([sparePartId]);
    CREATE INDEX [IX_scb_productId] ON [dbo].[spare_part_condition_balances] ([productId]);
    CREATE INDEX [IX_scb_warehouseId] ON [dbo].[spare_part_condition_balances] ([warehouseId]);
    CREATE INDEX [IX_scb_condition] ON [dbo].[spare_part_condition_balances] ([condition]);
    CREATE INDEX [IX_scb_lastMovementAt] ON [dbo].[spare_part_condition_balances] ([lastMovementAt]);

    ALTER TABLE [dbo].[spare_part_condition_balances] ADD CONSTRAINT [FK_scb_sparePart] FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts]([id]);
    ALTER TABLE [dbo].[spare_part_condition_balances] ADD CONSTRAINT [FK_scb_warehouse] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]);

    PRINT 'Created spare_part_condition_balances table';
END
ELSE
BEGIN
    PRINT 'spare_part_condition_balances table already exists -- skipping';
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[spare_part_condition_movements]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[spare_part_condition_movements] (
        [id]                   NVARCHAR(1000) NOT NULL,
        [movementNumber]       NVARCHAR(255)  NOT NULL,
        [sparePartId]          NVARCHAR(1000) NOT NULL,
        [productId]            NVARCHAR(1000) NULL,
        [warehouseId]          NVARCHAR(1000) NOT NULL,
        [condition]            NVARCHAR(50)   NOT NULL,
        [direction]            NVARCHAR(10)   NOT NULL,
        [quantity]             FLOAT          NOT NULL,
        [sourceType]           NVARCHAR(100)  NULL,
        [sourceId]             NVARCHAR(1000) NULL,
        [maintenanceRequestId] NVARCHAR(1000) NULL,
        [requiredPartId]       NVARCHAR(1000) NULL,
        [inventoryMovementId]  NVARCHAR(1000) NULL,
        [replacementAction]    NVARCHAR(50)   NULL,
        [notes]                NVARCHAR(1000) NULL,
        [createdByUserId]      NVARCHAR(1000) NULL,
        [createdAt]            DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_spare_part_condition_movements] PRIMARY KEY ([id]),
        CONSTRAINT [UQ_scm_movementNumber] UNIQUE ([movementNumber])
    );

    CREATE INDEX [IX_scm_sparePartId] ON [dbo].[spare_part_condition_movements] ([sparePartId]);
    CREATE INDEX [IX_scm_productId] ON [dbo].[spare_part_condition_movements] ([productId]);
    CREATE INDEX [IX_scm_warehouseId] ON [dbo].[spare_part_condition_movements] ([warehouseId]);
    CREATE INDEX [IX_scm_condition] ON [dbo].[spare_part_condition_movements] ([condition]);
    CREATE INDEX [IX_scm_direction] ON [dbo].[spare_part_condition_movements] ([direction]);
    CREATE INDEX [IX_scm_sourceType_sourceId] ON [dbo].[spare_part_condition_movements] ([sourceType], [sourceId]);
    CREATE INDEX [IX_scm_maintenanceRequestId] ON [dbo].[spare_part_condition_movements] ([maintenanceRequestId]);
    CREATE INDEX [IX_scm_requiredPartId] ON [dbo].[spare_part_condition_movements] ([requiredPartId]);
    CREATE INDEX [IX_scm_createdAt] ON [dbo].[spare_part_condition_movements] ([createdAt]);

    ALTER TABLE [dbo].[spare_part_condition_movements] ADD CONSTRAINT [FK_scm_sparePart] FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts]([id]);
    ALTER TABLE [dbo].[spare_part_condition_movements] ADD CONSTRAINT [FK_scm_warehouse] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]);
    ALTER TABLE [dbo].[spare_part_condition_movements] ADD CONSTRAINT [FK_scm_maintenanceRequest] FOREIGN KEY ([maintenanceRequestId]) REFERENCES [dbo].[maintenance_requests]([id]);
    ALTER TABLE [dbo].[spare_part_condition_movements] ADD CONSTRAINT [FK_scm_requiredPart] FOREIGN KEY ([requiredPartId]) REFERENCES [dbo].[maintenance_request_required_parts]([id]);
    ALTER TABLE [dbo].[spare_part_condition_movements] ADD CONSTRAINT [FK_scm_createdBy] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[users]([id]);

    PRINT 'Created spare_part_condition_movements table';
END
ELSE
BEGIN
    PRINT 'spare_part_condition_movements table already exists -- skipping';
END

PRINT 'Baseline 20260731000000 completed successfully (11 additive tables ensured).';
