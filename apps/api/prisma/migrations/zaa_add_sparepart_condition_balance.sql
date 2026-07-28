-- Z-AA: Add SparePartConditionBalance and SparePartConditionMovement
-- Date: 2026-07-28
-- Preflight: Verify tables don't already exist

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
GO

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
GO

PRINT 'Z-AA migration completed successfully';
GO
