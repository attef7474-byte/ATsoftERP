SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- ============================================================================
-- Phase 0 (Master Plan): MaintenanceWorkOrder slice.
-- New additive tables:
--   1. `maintenance_work_orders`           - work order header (tenant-scoped).
--   2. `maintenance_work_order_parts`      - part lines for the work order.
--   3. `maintenance_work_order_cost_entries` - cost entries for the work order.
-- 100% additive: new tables plus indexes. No existing column is altered,
-- renamed, or dropped.
--
-- Existing-data impact: none (new tables only).
-- Tenant impact: tables are tenant-scoped by companyId + branchId columns
-- (enforced in the service layer); unique number is scoped per branch.
-- Referential targets: companies, branches, machines, machine_components,
-- maintenance_requests, warehouses, users, spare_parts, products - all exist.
-- ============================================================================

IF OBJECT_ID(N'[dbo].[maintenance_work_orders]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[maintenance_work_orders] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [workOrderNumber] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [type] NVARCHAR(1000) NOT NULL
      CONSTRAINT [maintenance_work_orders_type_df] DEFAULT N'CORRECTIVE',
    [priority] NVARCHAR(1000) NOT NULL
      CONSTRAINT [maintenance_work_orders_priority_df] DEFAULT N'MEDIUM',
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [maintenance_work_orders_status_df] DEFAULT N'DRAFT',
    [machineId] NVARCHAR(1000) NULL,
    [machineComponentId] NVARCHAR(1000) NULL,
    [requestId] NVARCHAR(1000) NULL,
    [warehouseId] NVARCHAR(1000) NULL,
    [assignedToId] NVARCHAR(1000) NULL,
    [supervisorId] NVARCHAR(1000) NULL,
    [createdById] NVARCHAR(1000) NULL,
    [plannedStartAt] DATETIME2 NULL,
    [plannedEndAt] DATETIME2 NULL,
    [startedAt] DATETIME2 NULL,
    [completedAt] DATETIME2 NULL,
    [cancelledAt] DATETIME2 NULL,
    [cancelReason] NVARCHAR(1000) NULL,
    [estimatedCost] DECIMAL(18, 2) NULL,
    [actualCost] DECIMAL(18, 2) NULL,
    [notes] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [maintenance_work_orders_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [maintenance_work_orders_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [maintenance_work_orders_branchId_workOrderNumber_key] UNIQUE NONCLUSTERED ([branchId], [workOrderNumber]),
    CONSTRAINT [maintenance_work_orders_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_orders_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_orders_machineId_fkey]
      FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_orders_machineComponentId_fkey]
      FOREIGN KEY ([machineComponentId]) REFERENCES [dbo].[machine_components]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_orders_requestId_fkey]
      FOREIGN KEY ([requestId]) REFERENCES [dbo].[maintenance_requests]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_orders_warehouseId_fkey]
      FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_orders_assignedToId_fkey]
      FOREIGN KEY ([assignedToId]) REFERENCES [dbo].[users]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_orders_supervisorId_fkey]
      FOREIGN KEY ([supervisorId]) REFERENCES [dbo].[users]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_orders_createdById_fkey]
      FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[maintenance_work_order_parts]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[maintenance_work_order_parts] (
    [id] NVARCHAR(1000) NOT NULL,
    [workOrderId] NVARCHAR(1000) NOT NULL,
    [sparePartId] NVARCHAR(1000) NULL,
    [productId] NVARCHAR(1000) NULL,
    [quantity] FLOAT NOT NULL,
    [unit] NVARCHAR(1000) NULL,
    [unitCost] DECIMAL(18, 2) NULL,
    [totalCost] DECIMAL(18, 2) NULL,
    [notes] NVARCHAR(1000) NULL,
    [issuedQuantity] FLOAT NOT NULL
      CONSTRAINT [maintenance_work_order_parts_issuedQuantity_df] DEFAULT 0,
    [stockIssueStatus] NVARCHAR(1000) NOT NULL
      CONSTRAINT [maintenance_work_order_parts_stockIssueStatus_df] DEFAULT N'PENDING',
    [lastIssueAt] DATETIME2 NULL,
    [lastIssueById] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [maintenance_work_order_parts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_work_order_parts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [maintenance_work_order_parts_workOrderId_fkey]
      FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[maintenance_work_orders]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_order_parts_sparePartId_fkey]
      FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_order_parts_productId_fkey]
      FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_order_parts_lastIssueById_fkey]
      FOREIGN KEY ([lastIssueById]) REFERENCES [dbo].[users]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[maintenance_work_order_cost_entries]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[maintenance_work_order_cost_entries] (
    [id] NVARCHAR(1000) NOT NULL,
    [workOrderId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [amount] DECIMAL(18, 2) NOT NULL,
    [incurredAt] DATETIME2 NOT NULL
      CONSTRAINT [maintenance_work_order_cost_entries_incurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [maintenance_work_order_cost_entries_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_work_order_cost_entries_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [maintenance_work_order_cost_entries_workOrderId_fkey]
      FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[maintenance_work_orders]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [maintenance_work_order_cost_entries_createdById_fkey]
      FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

-- ── maintenance_work_orders indexes ────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_companyId_idx]
    ON [dbo].[maintenance_work_orders]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_branchId_idx]
    ON [dbo].[maintenance_work_orders]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_status_idx]
    ON [dbo].[maintenance_work_orders]([status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_type_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_type_idx]
    ON [dbo].[maintenance_work_orders]([type]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_priority_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_priority_idx]
    ON [dbo].[maintenance_work_orders]([priority]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_machineId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_machineId_idx]
    ON [dbo].[maintenance_work_orders]([machineId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_machineComponentId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_machineComponentId_idx]
    ON [dbo].[maintenance_work_orders]([machineComponentId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_requestId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_requestId_idx]
    ON [dbo].[maintenance_work_orders]([requestId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_assignedToId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_assignedToId_idx]
    ON [dbo].[maintenance_work_orders]([assignedToId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_supervisorId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_supervisorId_idx]
    ON [dbo].[maintenance_work_orders]([supervisorId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_createdById_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_createdById_idx]
    ON [dbo].[maintenance_work_orders]([createdById]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_companyId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_companyId_status_idx]
    ON [dbo].[maintenance_work_orders]([companyId], [status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_branchId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_branchId_status_idx]
    ON [dbo].[maintenance_work_orders]([branchId], [status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_branchId_status_priority_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_branchId_status_priority_idx]
    ON [dbo].[maintenance_work_orders]([branchId], [status], [priority]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_orders_createdAt_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_orders]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_orders_createdAt_idx]
    ON [dbo].[maintenance_work_orders]([createdAt]);

-- ── maintenance_work_order_parts indexes ────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_order_parts_workOrderId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_order_parts]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_order_parts_workOrderId_idx]
    ON [dbo].[maintenance_work_order_parts]([workOrderId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_order_parts_sparePartId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_order_parts]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_order_parts_sparePartId_idx]
    ON [dbo].[maintenance_work_order_parts]([sparePartId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_order_parts_productId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_order_parts]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_order_parts_productId_idx]
    ON [dbo].[maintenance_work_order_parts]([productId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_order_parts_stockIssueStatus_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_order_parts]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_order_parts_stockIssueStatus_idx]
    ON [dbo].[maintenance_work_order_parts]([stockIssueStatus]);

-- ── maintenance_work_order_cost_entries indexes ─────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_order_cost_entries_workOrderId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_order_cost_entries]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_order_cost_entries_workOrderId_idx]
    ON [dbo].[maintenance_work_order_cost_entries]([workOrderId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'maintenance_work_order_cost_entries_type_idx'
    AND object_id = OBJECT_ID(N'[dbo].[maintenance_work_order_cost_entries]')
)
  CREATE NONCLUSTERED INDEX [maintenance_work_order_cost_entries_type_idx]
    ON [dbo].[maintenance_work_order_cost_entries]([type]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
