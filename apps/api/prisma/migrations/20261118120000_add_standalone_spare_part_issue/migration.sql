-- Standalone spare-part issue voucher (ADDITIVE, NON-DESTRUCTIVE).
--
-- Adds:
--   1) spare_part_issues - tenant/branch-owned standalone spare-part OUT authority.
--      It has no maintenance request or production order FK by design: a real
--      spare part must be issuable without fabricating unrelated domain records.
--   2) spare_part_issue_lines - immutable-per-document spare part + linked product
--      snapshots, including stock identity and scalar UOM snapshot.
--
-- Preserves: every existing table, column, row, index and constraint. No drop,
-- no truncate, no destructive UPDATE, no backfill, no stock recalculation, and
-- no edit to any applied migration. Existing data is untouched.
--
-- Physical stock remains owned exclusively by InventoryMovement. The new rows
-- carry a nullable movementId that is populated only when the authorized service
-- posts a real inventory movement inside its transaction.
--
-- Prisma sends migration.sql as ONE batch and does not honor GO, so every
-- statement that references an object created earlier in this same batch is
-- deferred through sys.sp_executesql (runtime recompile), matching the existing
-- project convention.
--
-- Rollback/recovery: this change is purely additive. Recovery is a separately
-- reviewed follow-up migration that drops only these two new tables and their
-- indexes/FKs after confirming no application version references them; no
-- existing business data is modified by this migration or its rollback.

BEGIN TRY

BEGIN TRAN;

-- 1) spare_part_issues
CREATE TABLE [dbo].[spare_part_issues] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [issueNumber] NVARCHAR(1000) NOT NULL,
    [issueWarehouseId] NVARCHAR(1000) NOT NULL,
    [purpose] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [spare_part_issues_status_df] DEFAULT 'DRAFT',
    [movementId] NVARCHAR(1000),
    [movementNumber] NVARCHAR(1000),
    [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [spare_part_issues_sourceType_df] DEFAULT 'MANUAL',
    [requestId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [issueDate] DATETIME2 NOT NULL CONSTRAINT [spare_part_issues_issueDate_df] DEFAULT CURRENT_TIMESTAMP,
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
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [spare_part_issues_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [spare_part_issues_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- 2) spare_part_issue_lines
CREATE TABLE [dbo].[spare_part_issue_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [issueId] NVARCHAR(1000) NOT NULL,
    [sparePartId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [sparePartCodeSnapshot] NVARCHAR(1000) NOT NULL,
    [sparePartNameSnapshot] NVARCHAR(1000) NOT NULL,
    [productCodeSnapshot] NVARCHAR(1000) NOT NULL,
    [productNameSnapshot] NVARCHAR(1000) NOT NULL,
    [unit] NVARCHAR(1000) NOT NULL,
    [quantity] DECIMAL(18,4) NOT NULL,
    -- Scalar historical UOM snapshot: deliberately no FK (see schema.prisma).
    [productUomId] NVARCHAR(1000),
    [warehouseLocationId] NVARCHAR(1000),
    [batchNumber] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [expiryDate] DATETIME2,
    [lineNumber] INT NOT NULL CONSTRAINT [spare_part_issue_lines_lineNumber_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [spare_part_issue_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [spare_part_issue_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- 3) Indexes and uniqueness (deferred recompile: tables were created above).
EXEC sys.sp_executesql N'CREATE UNIQUE NONCLUSTERED INDEX [spare_part_issues_companyId_branchId_issueNumber_key] ON [dbo].[spare_part_issues]([companyId],[branchId],[issueNumber])';
EXEC sys.sp_executesql N'CREATE UNIQUE NONCLUSTERED INDEX [spare_part_issues_companyId_branchId_movementId_key] ON [dbo].[spare_part_issues]([companyId],[branchId],[movementId])';
-- The filtered unique index is the single idempotency authority for requestId.
-- The plain non-unique index below exists only for Prisma schema parity and
-- tenant-scoped lookup; SQL Server treats NULLs as equal in a plain UNIQUE index.
EXEC sys.sp_executesql N'CREATE UNIQUE NONCLUSTERED INDEX [spare_part_issues_companyId_branchId_requestId_key] ON [dbo].[spare_part_issues]([companyId],[branchId],[requestId]) WHERE [requestId] IS NOT NULL';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issues_companyId_branchId_requestId_idx] ON [dbo].[spare_part_issues]([companyId],[branchId],[requestId])';

EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issues_companyId_branchId_status_idx] ON [dbo].[spare_part_issues]([companyId],[branchId],[status])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issues_companyId_branchId_issueDate_idx] ON [dbo].[spare_part_issues]([companyId],[branchId],[issueDate])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issues_companyId_branchId_issueWarehouseId_idx] ON [dbo].[spare_part_issues]([companyId],[branchId],[issueWarehouseId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issues_movementId_idx] ON [dbo].[spare_part_issues]([movementId])';

EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issue_lines_issueId_idx] ON [dbo].[spare_part_issue_lines]([issueId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issue_lines_sparePartId_idx] ON [dbo].[spare_part_issue_lines]([sparePartId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issue_lines_productId_idx] ON [dbo].[spare_part_issue_lines]([productId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issue_lines_warehouseLocationId_idx] ON [dbo].[spare_part_issue_lines]([warehouseLocationId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [spare_part_issue_lines_issueId_sparePartId_idx] ON [dbo].[spare_part_issue_lines]([issueId],[sparePartId])';

-- 4) Foreign keys. All NoAction; tenant compatibility is enforced in the service.
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issues] ADD CONSTRAINT [spare_part_issues_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issues] ADD CONSTRAINT [spare_part_issues_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issues] ADD CONSTRAINT [spare_part_issues_issueWarehouseId_fkey] FOREIGN KEY ([issueWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issues] ADD CONSTRAINT [spare_part_issues_movementId_fkey] FOREIGN KEY ([movementId]) REFERENCES [dbo].[inventory_movements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';

EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issue_lines] ADD CONSTRAINT [spare_part_issue_lines_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issue_lines] ADD CONSTRAINT [spare_part_issue_lines_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issue_lines] ADD CONSTRAINT [spare_part_issue_lines_issueId_fkey] FOREIGN KEY ([issueId]) REFERENCES [dbo].[spare_part_issues]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issue_lines] ADD CONSTRAINT [spare_part_issue_lines_sparePartId_fkey] FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issue_lines] ADD CONSTRAINT [spare_part_issue_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[spare_part_issue_lines] ADD CONSTRAINT [spare_part_issue_lines_warehouseLocationId_fkey] FOREIGN KEY ([warehouseLocationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
