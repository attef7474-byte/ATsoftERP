-- Unified Issue Requests & Warehouse Approvals (ADDITIVE, NON-DESTRUCTIVE).
--
-- Adds:
--   1) Requester submission / separate warehouse decision columns on
--      production_material_documents (raw-material requests). All nullable so
--      historical rows keep their status; no synthetic approval data is invented.
--   2) finished_goods_issues - the canonical finished-goods OUT authority. It is a
--      NEW authority; production_finished_goods_receipts stays the IN authority.
--   3) finished_goods_issue_lines - immutable quantity snapshots per product.
--
-- Preserves: every existing table, column, row, index and constraint. No drop,
-- no truncate, no NOT NULL on legacy columns, no stock recalculation.
--
-- Prisma sends migration.sql as ONE batch and does not honor GO, so every
-- statement that references an object created earlier in this same batch is
-- deferred through sys.sp_executesql (runtime recompile), matching the existing
-- project convention.

BEGIN TRY

BEGIN TRAN;

-- 1) production_material_documents: requester submission + warehouse decision.
IF COL_LENGTH('dbo.production_material_documents', 'submittedAt') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [submittedAt] DATETIME2;
IF COL_LENGTH('dbo.production_material_documents', 'submittedById') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [submittedById] NVARCHAR(1000);
IF COL_LENGTH('dbo.production_material_documents', 'approvedAt') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [approvedAt] DATETIME2;
IF COL_LENGTH('dbo.production_material_documents', 'approvedById') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [approvedById] NVARCHAR(1000);
IF COL_LENGTH('dbo.production_material_documents', 'rejectedAt') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [rejectedAt] DATETIME2;
IF COL_LENGTH('dbo.production_material_documents', 'rejectedById') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [rejectedById] NVARCHAR(1000);
IF COL_LENGTH('dbo.production_material_documents', 'rejectionReason') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [rejectionReason] NVARCHAR(1000);
IF COL_LENGTH('dbo.production_material_documents', 'withdrawnAt') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [withdrawnAt] DATETIME2;
IF COL_LENGTH('dbo.production_material_documents', 'withdrawnById') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [withdrawnById] NVARCHAR(1000);
IF COL_LENGTH('dbo.production_material_documents', 'approvalCancelledAt') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [approvalCancelledAt] DATETIME2;
IF COL_LENGTH('dbo.production_material_documents', 'approvalCancelledById') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [approvalCancelledById] NVARCHAR(1000);
IF COL_LENGTH('dbo.production_material_documents', 'approvalCancellationReason') IS NULL
    ALTER TABLE [dbo].[production_material_documents] ADD [approvalCancellationReason] NVARCHAR(1000);

-- 2) finished_goods_issues
CREATE TABLE [dbo].[finished_goods_issues] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [issueNumber] NVARCHAR(1000) NOT NULL,
    [issueWarehouseId] NVARCHAR(1000) NOT NULL,
    [purpose] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [finished_goods_issues_status_df] DEFAULT 'DRAFT',
    [movementId] NVARCHAR(1000),
    [movementNumber] NVARCHAR(1000),
    [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [finished_goods_issues_sourceType_df] DEFAULT 'MANUAL',
    [requestId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [issueDate] DATETIME2 NOT NULL CONSTRAINT [finished_goods_issues_issueDate_df] DEFAULT CURRENT_TIMESTAMP,
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
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [finished_goods_issues_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [reversesIssueId] NVARCHAR(1000),
    CONSTRAINT [finished_goods_issues_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- 3) finished_goods_issue_lines
CREATE TABLE [dbo].[finished_goods_issue_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [issueId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [productCodeSnapshot] NVARCHAR(1000) NOT NULL,
    [productNameSnapshot] NVARCHAR(1000) NOT NULL,
    [unit] NVARCHAR(1000) NOT NULL,
    [quantity] DECIMAL(18,4) NOT NULL,
    [warehouseLocationId] NVARCHAR(1000),
    [batchNumber] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [expiryDate] DATETIME2,
    [lineNumber] INT NOT NULL CONSTRAINT [finished_goods_issue_lines_lineNumber_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [finished_goods_issue_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [finished_goods_issue_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- 4) Indexes and uniqueness (deferred recompile: the tables were created above).
EXEC sys.sp_executesql N'CREATE UNIQUE NONCLUSTERED INDEX [finished_goods_issues_companyId_branchId_issueNumber_key] ON [dbo].[finished_goods_issues]([companyId],[branchId],[issueNumber])';
EXEC sys.sp_executesql N'CREATE UNIQUE NONCLUSTERED INDEX [finished_goods_issues_companyId_branchId_movementId_key] ON [dbo].[finished_goods_issues]([companyId],[branchId],[movementId])';
-- SQL Server treats NULLs as equal in a UNIQUE constraint/index, so the idempotency
-- token is unique only when present (same convention as production_material_documents).
EXEC sys.sp_executesql N'CREATE UNIQUE NONCLUSTERED INDEX [finished_goods_issues_companyId_branchId_requestId_key] ON [dbo].[finished_goods_issues]([companyId],[branchId],[requestId]) WHERE [requestId] IS NOT NULL';

EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [finished_goods_issues_companyId_branchId_status_idx] ON [dbo].[finished_goods_issues]([companyId],[branchId],[status])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [finished_goods_issues_companyId_branchId_issueDate_idx] ON [dbo].[finished_goods_issues]([companyId],[branchId],[issueDate])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [finished_goods_issues_companyId_branchId_issueWarehouseId_idx] ON [dbo].[finished_goods_issues]([companyId],[branchId],[issueWarehouseId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [finished_goods_issues_movementId_idx] ON [dbo].[finished_goods_issues]([movementId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [finished_goods_issues_reversesIssueId_idx] ON [dbo].[finished_goods_issues]([reversesIssueId])';

EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [finished_goods_issue_lines_issueId_idx] ON [dbo].[finished_goods_issue_lines]([issueId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [finished_goods_issue_lines_productId_idx] ON [dbo].[finished_goods_issue_lines]([productId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [finished_goods_issue_lines_warehouseLocationId_idx] ON [dbo].[finished_goods_issue_lines]([warehouseLocationId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [finished_goods_issue_lines_issueId_productId_idx] ON [dbo].[finished_goods_issue_lines]([issueId],[productId])';

-- 5) Foreign keys.
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issues] ADD CONSTRAINT [finished_goods_issues_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issues] ADD CONSTRAINT [finished_goods_issues_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issues] ADD CONSTRAINT [finished_goods_issues_issueWarehouseId_fkey] FOREIGN KEY ([issueWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issues] ADD CONSTRAINT [finished_goods_issues_movementId_fkey] FOREIGN KEY ([movementId]) REFERENCES [dbo].[inventory_movements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issues] ADD CONSTRAINT [finished_goods_issues_reversesIssueId_fkey] FOREIGN KEY ([reversesIssueId]) REFERENCES [dbo].[finished_goods_issues]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';

EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issue_lines] ADD CONSTRAINT [finished_goods_issue_lines_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issue_lines] ADD CONSTRAINT [finished_goods_issue_lines_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issue_lines] ADD CONSTRAINT [finished_goods_issue_lines_issueId_fkey] FOREIGN KEY ([issueId]) REFERENCES [dbo].[finished_goods_issues]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issue_lines] ADD CONSTRAINT [finished_goods_issue_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[finished_goods_issue_lines] ADD CONSTRAINT [finished_goods_issue_lines_warehouseLocationId_fkey] FOREIGN KEY ([warehouseLocationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
