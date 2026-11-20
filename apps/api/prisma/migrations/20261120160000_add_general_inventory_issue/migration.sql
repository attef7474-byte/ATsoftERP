-- General inventory OUT authority (ADDITIVE, NON-DESTRUCTIVE).
--
-- Adds:
--   1) general_inventory_issues - tenant/branch-owned flat OUT authority for
--      PACKAGING_MATERIAL, CONSUMABLE and GENERAL Product classifications.
--   2) general_inventory_issue_lines - immutable-per-document Product snapshots,
--      including stock identity and scalar transaction-UOM snapshots.
--
-- Preserves: every existing table, column, row, index and constraint. No drop,
-- no truncate, no destructive UPDATE, no backfill, no stock recalculation, and
-- no edit to any applied migration. Existing data is untouched.
--
-- Physical stock remains owned exclusively by InventoryMovement. The new rows
-- carry a nullable movementId that is populated only when the authorized service
-- creates/posts a real inventory movement inside its transaction.
--
-- Prisma sends migration.sql as ONE batch and does not honor GO, so every
-- statement that references an object created earlier in this same batch is
-- deferred through sys.sp_executesql (runtime recompile), matching the existing
-- project convention. All DDL is guarded so a reviewed re-run is idempotent.
--
-- Rollback/recovery: purely additive. Recovery is a separately reviewed follow-up
-- migration that drops only these two new tables and their indexes/FKs after
-- confirming no application version references them; no existing business data
-- is modified by this migration or its rollback.

BEGIN TRY

BEGIN TRAN;

-- 1) general_inventory_issues
IF OBJECT_ID(N'dbo.general_inventory_issues', N'U') IS NULL
BEGIN
CREATE TABLE [dbo].[general_inventory_issues] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [issueNumber] NVARCHAR(1000) NOT NULL,
    [issueType] NVARCHAR(1000) NOT NULL,
    [issueWarehouseId] NVARCHAR(1000) NOT NULL,
    [purpose] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [general_inventory_issues_status_df] DEFAULT 'DRAFT',
    [movementId] NVARCHAR(1000),
    [movementNumber] NVARCHAR(1000),
    [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [general_inventory_issues_sourceType_df] DEFAULT 'MANUAL',
    [requestId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [issueDate] DATETIME2 NOT NULL CONSTRAINT [general_inventory_issues_issueDate_df] DEFAULT CURRENT_TIMESTAMP,
    [submittedAt] DATETIME2,
    [submittedById] NVARCHAR(1000),
    [approvedAt] DATETIME2,
    [approvedById] NVARCHAR(1000),
    [rejectedAt] DATETIME2,
    [rejectedById] NVARCHAR(1000),
    [rejectionReason] NVARCHAR(1000),
    [withdrawnAt] DATETIME2,
    [withdrawnById] NVARCHAR(1000),
    [approvalCancelledAt] DATETIME2,
    [approvalCancelledById] NVARCHAR(1000),
    [approvalCancellationReason] NVARCHAR(1000),
    [postedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdById] NVARCHAR(1000) NOT NULL,
    [postedById] NVARCHAR(1000),
    [cancelledById] NVARCHAR(1000),
    [reversesIssueId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [general_inventory_issues_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [general_inventory_issues_pkey] PRIMARY KEY CLUSTERED ([id])
);
END;

-- 2) general_inventory_issue_lines
IF OBJECT_ID(N'dbo.general_inventory_issue_lines', N'U') IS NULL
BEGIN
CREATE TABLE [dbo].[general_inventory_issue_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [issueId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [productCodeSnapshot] NVARCHAR(1000) NOT NULL,
    [productNameSnapshot] NVARCHAR(1000) NOT NULL,
    [unit] NVARCHAR(1000) NOT NULL,
    [quantity] DECIMAL(18,4) NOT NULL,
    -- Scalar historical UOM snapshots: deliberately no FK (see schema.prisma).
    [productUomId] NVARCHAR(1000),
    [enteredUnitId] NVARCHAR(1000),
    [warehouseLocationId] NVARCHAR(1000),
    [batchNumber] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [expiryDate] DATETIME2,
    [lineNumber] INT NOT NULL CONSTRAINT [general_inventory_issue_lines_lineNumber_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [general_inventory_issue_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [general_inventory_issue_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);
END;

-- 3) Trusted CHECK constraints for the exact issueType and status vocabularies.
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''general_inventory_issues_issueType_ck'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  ALTER TABLE [dbo].[general_inventory_issues] WITH CHECK ADD CONSTRAINT [general_inventory_issues_issueType_ck]
    CHECK ([issueType] IN (N''PACKAGING_MATERIAL'', N''CONSUMABLE'', N''GENERAL''));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''general_inventory_issues_issueType_ck'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  ALTER TABLE [dbo].[general_inventory_issues] CHECK CONSTRAINT [general_inventory_issues_issueType_ck];
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''general_inventory_issues_status_ck'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  ALTER TABLE [dbo].[general_inventory_issues] WITH CHECK ADD CONSTRAINT [general_inventory_issues_status_ck]
    CHECK ([status] IN (N''DRAFT'', N''SUBMITTED'', N''APPROVED'', N''REJECTED'', N''POSTED'', N''CANCELLED''));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''general_inventory_issues_status_ck'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  ALTER TABLE [dbo].[general_inventory_issues] CHECK CONSTRAINT [general_inventory_issues_status_ck];
';

-- 4) Indexes and uniqueness (deferred recompile: tables were created above).
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_companyId_branchId_issueNumber_key'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE UNIQUE NONCLUSTERED INDEX [general_inventory_issues_companyId_branchId_issueNumber_key] ON [dbo].[general_inventory_issues]([companyId],[branchId],[issueNumber]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_companyId_branchId_movementId_key'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE UNIQUE NONCLUSTERED INDEX [general_inventory_issues_companyId_branchId_movementId_key] ON [dbo].[general_inventory_issues]([companyId],[branchId],[movementId]);
';
-- Filtered unique index is the single idempotency authority for requestId.
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_companyId_branchId_requestId_key'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE UNIQUE NONCLUSTERED INDEX [general_inventory_issues_companyId_branchId_requestId_key] ON [dbo].[general_inventory_issues]([companyId],[branchId],[requestId]) WHERE [requestId] IS NOT NULL;
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_companyId_branchId_requestId_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE NONCLUSTERED INDEX [general_inventory_issues_companyId_branchId_requestId_idx] ON [dbo].[general_inventory_issues]([companyId],[branchId],[requestId]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_companyId_branchId_status_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE NONCLUSTERED INDEX [general_inventory_issues_companyId_branchId_status_idx] ON [dbo].[general_inventory_issues]([companyId],[branchId],[status]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_companyId_branchId_issueDate_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE NONCLUSTERED INDEX [general_inventory_issues_companyId_branchId_issueDate_idx] ON [dbo].[general_inventory_issues]([companyId],[branchId],[issueDate]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_companyId_branchId_issueWarehouseId_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE NONCLUSTERED INDEX [general_inventory_issues_companyId_branchId_issueWarehouseId_idx] ON [dbo].[general_inventory_issues]([companyId],[branchId],[issueWarehouseId]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_companyId_branchId_issueType_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE NONCLUSTERED INDEX [general_inventory_issues_companyId_branchId_issueType_idx] ON [dbo].[general_inventory_issues]([companyId],[branchId],[issueType]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_movementId_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE NONCLUSTERED INDEX [general_inventory_issues_movementId_idx] ON [dbo].[general_inventory_issues]([movementId]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issues_reversesIssueId_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  CREATE NONCLUSTERED INDEX [general_inventory_issues_reversesIssueId_idx] ON [dbo].[general_inventory_issues]([reversesIssueId]);
';

EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issue_lines_issueId_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issue_lines''))
  CREATE NONCLUSTERED INDEX [general_inventory_issue_lines_issueId_idx] ON [dbo].[general_inventory_issue_lines]([issueId]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issue_lines_productId_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issue_lines''))
  CREATE NONCLUSTERED INDEX [general_inventory_issue_lines_productId_idx] ON [dbo].[general_inventory_issue_lines]([productId]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issue_lines_warehouseLocationId_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issue_lines''))
  CREATE NONCLUSTERED INDEX [general_inventory_issue_lines_warehouseLocationId_idx] ON [dbo].[general_inventory_issue_lines]([warehouseLocationId]);
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''general_inventory_issue_lines_issueId_productId_idx'' AND object_id = OBJECT_ID(N''dbo.general_inventory_issue_lines''))
  CREATE NONCLUSTERED INDEX [general_inventory_issue_lines_issueId_productId_idx] ON [dbo].[general_inventory_issue_lines]([issueId],[productId]);
';

-- 5) Foreign keys. All NoAction; tenant compatibility is enforced in the service.
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issues_companyId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  ALTER TABLE [dbo].[general_inventory_issues] ADD CONSTRAINT [general_inventory_issues_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issues_branchId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  ALTER TABLE [dbo].[general_inventory_issues] ADD CONSTRAINT [general_inventory_issues_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issues_issueWarehouseId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  ALTER TABLE [dbo].[general_inventory_issues] ADD CONSTRAINT [general_inventory_issues_issueWarehouseId_fkey] FOREIGN KEY ([issueWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issues_movementId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  ALTER TABLE [dbo].[general_inventory_issues] ADD CONSTRAINT [general_inventory_issues_movementId_fkey] FOREIGN KEY ([movementId]) REFERENCES [dbo].[inventory_movements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issues_reversesIssueId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issues''))
  ALTER TABLE [dbo].[general_inventory_issues] ADD CONSTRAINT [general_inventory_issues_reversesIssueId_fkey] FOREIGN KEY ([reversesIssueId]) REFERENCES [dbo].[general_inventory_issues]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';

EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issue_lines_companyId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issue_lines''))
  ALTER TABLE [dbo].[general_inventory_issue_lines] ADD CONSTRAINT [general_inventory_issue_lines_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issue_lines_branchId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issue_lines''))
  ALTER TABLE [dbo].[general_inventory_issue_lines] ADD CONSTRAINT [general_inventory_issue_lines_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issue_lines_issueId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issue_lines''))
  ALTER TABLE [dbo].[general_inventory_issue_lines] ADD CONSTRAINT [general_inventory_issue_lines_issueId_fkey] FOREIGN KEY ([issueId]) REFERENCES [dbo].[general_inventory_issues]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issue_lines_productId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issue_lines''))
  ALTER TABLE [dbo].[general_inventory_issue_lines] ADD CONSTRAINT [general_inventory_issue_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';
EXEC sys.sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N''general_inventory_issue_lines_warehouseLocationId_fkey'' AND parent_object_id = OBJECT_ID(N''dbo.general_inventory_issue_lines''))
  ALTER TABLE [dbo].[general_inventory_issue_lines] ADD CONSTRAINT [general_inventory_issue_lines_warehouseLocationId_fkey] FOREIGN KEY ([warehouseLocationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
