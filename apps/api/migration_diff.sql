鈼?injected env (28) from .env // tip: 鈼?encrypted .env [www.dotenvx.com]
Loaded Prisma config from prisma.config.ts.

BEGIN TRY

BEGIN TRAN;

-- DropIndex
DROP INDEX [IX_mrrp_stockIssueStatus] ON [dbo].[maintenance_request_required_parts];

-- DropIndex
DROP INDEX [IX_mrrp_warehouseId] ON [dbo].[maintenance_request_required_parts];

-- AlterTable
ALTER TABLE [dbo].[maintenance_request_required_parts] DROP CONSTRAINT [DF_mrrp_issuedQuantity],
[DF_mrrp_returnedQuantity],
[DF_mrrp_stockIssueStatus];
ALTER TABLE [dbo].[maintenance_request_required_parts] ALTER COLUMN [stockIssueStatus] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[maintenance_request_required_parts] ADD CONSTRAINT [maintenance_request_required_parts_issuedQuantity_df] DEFAULT 0 FOR [issuedQuantity], CONSTRAINT [maintenance_request_required_parts_returnedQuantity_df] DEFAULT 0 FOR [returnedQuantity], CONSTRAINT [maintenance_request_required_parts_stockIssueStatus_df] DEFAULT 'NOT_ISSUED' FOR [stockIssueStatus];

-- AlterTable
ALTER TABLE [dbo].[maintenance_requests] ALTER COLUMN [slaStatus] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[maintenance_requests] ALTER COLUMN [escalationLevel] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[maintenance_requests] DROP COLUMN [complete_due_at],
[escalation_level],
[last_escalated_at],
[response_due_at],
[sla_status],
[start_due_at];
ALTER TABLE [dbo].[maintenance_requests] ADD CONSTRAINT [maintenance_requests_escalationLevel_df] DEFAULT 'NONE' FOR [escalationLevel], CONSTRAINT [maintenance_requests_slaStatus_df] DEFAULT 'ON_TRACK' FOR [slaStatus];

-- AlterTable
ALTER TABLE [dbo].[maintenance_sla_rules] DROP CONSTRAINT [DF__maintenan__prior__6CC31A31],
[DF__maintenanc__type__6DB73E6A],
[PK__maintena__3213E83FE0BF4E2C];
EXEC SP_RENAME N'dbo.PK__maintena__3213E83FE0BF4E2C', N'maintenance_sla_rules_pkey';
ALTER TABLE [dbo].[maintenance_sla_rules] ALTER COLUMN [id] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[maintenance_sla_rules] ALTER COLUMN [name] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[maintenance_sla_rules] ALTER COLUMN [priority] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[maintenance_sla_rules] ALTER COLUMN [type] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[maintenance_sla_rules] DROP COLUMN [complete_hours],
[created_at],
[escalation_delay_hours],
[escalation_levels],
[is_active],
[response_hours],
[start_hours],
[updated_at];
ALTER TABLE [dbo].[maintenance_sla_rules] ADD CONSTRAINT [maintenance_sla_rules_priority_df] DEFAULT 'MEDIUM' FOR [priority], CONSTRAINT [maintenance_sla_rules_type_df] DEFAULT 'BOTH' FOR [type], CONSTRAINT maintenance_sla_rules_pkey PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[maintenance_sla_rules] ADD [completeHours] FLOAT(53),
[createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_sla_rules_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
[escalationDelayHours] FLOAT(53) CONSTRAINT [maintenance_sla_rules_escalationDelayHours_df] DEFAULT 0,
[escalationLevels] INT CONSTRAINT [maintenance_sla_rules_escalationLevels_df] DEFAULT 1,
[isActive] BIT NOT NULL CONSTRAINT [maintenance_sla_rules_isActive_df] DEFAULT 1,
[responseHours] FLOAT(53),
[startHours] FLOAT(53),
[updatedAt] DATETIME2 NOT NULL;

-- AlterTable
EXEC SP_RENAME N'dbo.PK__maintena__3213E83F6888E1F0', N'maintenance_sla_states_pkey';
ALTER TABLE [dbo].[maintenance_sla_states] DROP COLUMN [complete_actual_at],
[complete_due_at],
[complete_overdue_min],
[created_at],
[escalation_level],
[last_escalated_at],
[maintenance_request_id],
[response_actual_at],
[response_due_at],
[response_overdue_min],
[sla_status],
[start_actual_at],
[start_due_at],
[start_overdue_min],
[updated_at];
ALTER TABLE [dbo].[maintenance_sla_states] ADD [completeActualAt] DATETIME2,
[completeDueAt] DATETIME2,
[completeOverdueMin] INT,
[createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_sla_states_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
[escalationLevel] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_sla_states_escalationLevel_df] DEFAULT 'NONE',
[lastEscalatedAt] DATETIME2,
[maintenanceRequestId] NVARCHAR(1000) NOT NULL,
[responseActualAt] DATETIME2,
[responseDueAt] DATETIME2,
[responseOverdueMin] INT,
[slaStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_sla_states_slaStatus_df] DEFAULT 'ON_TRACK',
[startActualAt] DATETIME2,
[startDueAt] DATETIME2,
[startOverdueMin] INT,
[updatedAt] DATETIME2 NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[operational_people] DROP CONSTRAINT [operational_people_category_df];
ALTER TABLE [dbo].[operational_people] ADD CONSTRAINT [operational_people_category_df] DEFAULT 'MAINTENANCE' FOR [category];

-- CreateTable
CREATE TABLE [dbo].[inventory_opening_balances] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [locationId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_opening_balances_status_df] DEFAULT 'DRAFT',
    [documentDate] DATETIME2 NOT NULL CONSTRAINT [inventory_opening_balances_documentDate_df] DEFAULT CURRENT_TIMESTAMP,
    [reason] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_opening_balances_reason_df] DEFAULT '',
    [notes] NVARCHAR(1000),
    [submittedAt] DATETIME2,
    [submittedById] NVARCHAR(1000),
    [approvedAt] DATETIME2,
    [approvedById] NVARCHAR(1000),
    [postedAt] DATETIME2,
    [postedById] NVARCHAR(1000),
    [rejectedAt] DATETIME2,
    [rejectedById] NVARCHAR(1000),
    [cancelledAt] DATETIME2,
    [cancelledById] NVARCHAR(1000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_opening_balances_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [inventory_opening_balances_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_opening_balances_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_opening_balance_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [openingBalanceId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [locationId] NVARCHAR(1000),
    [quantity] FLOAT(53) NOT NULL,
    [movementId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_opening_balance_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [inventory_opening_balance_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_stock_adjustments] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [locationId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_stock_adjustments_status_df] DEFAULT 'DRAFT',
    [documentDate] DATETIME2 NOT NULL CONSTRAINT [inventory_stock_adjustments_documentDate_df] DEFAULT CURRENT_TIMESTAMP,
    [reason] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_stock_adjustments_reason_df] DEFAULT '',
    [notes] NVARCHAR(1000),
    [submittedAt] DATETIME2,
    [submittedById] NVARCHAR(1000),
    [approvedAt] DATETIME2,
    [approvedById] NVARCHAR(1000),
    [postedAt] DATETIME2,
    [postedById] NVARCHAR(1000),
    [rejectedAt] DATETIME2,
    [rejectedById] NVARCHAR(1000),
    [cancelledAt] DATETIME2,
    [cancelledById] NVARCHAR(1000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_stock_adjustments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [inventory_stock_adjustments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_stock_adjustments_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_stock_adjustment_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [adjustmentId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [locationId] NVARCHAR(1000),
    [adjustmentType] NVARCHAR(1000) NOT NULL,
    [quantity] FLOAT(53) NOT NULL,
    [movementId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_stock_adjustment_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [inventory_stock_adjustment_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balances_companyId_idx] ON [dbo].[inventory_opening_balances]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balances_branchId_idx] ON [dbo].[inventory_opening_balances]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balances_warehouseId_idx] ON [dbo].[inventory_opening_balances]([warehouseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balances_status_idx] ON [dbo].[inventory_opening_balances]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balances_documentDate_idx] ON [dbo].[inventory_opening_balances]([documentDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balances_code_idx] ON [dbo].[inventory_opening_balances]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balances_createdAt_idx] ON [dbo].[inventory_opening_balances]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balance_lines_openingBalanceId_idx] ON [dbo].[inventory_opening_balance_lines]([openingBalanceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balance_lines_productId_idx] ON [dbo].[inventory_opening_balance_lines]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balance_lines_movementId_idx] ON [dbo].[inventory_opening_balance_lines]([movementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_companyId_idx] ON [dbo].[inventory_stock_adjustments]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_branchId_idx] ON [dbo].[inventory_stock_adjustments]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_warehouseId_idx] ON [dbo].[inventory_stock_adjustments]([warehouseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_status_idx] ON [dbo].[inventory_stock_adjustments]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_documentDate_idx] ON [dbo].[inventory_stock_adjustments]([documentDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_code_idx] ON [dbo].[inventory_stock_adjustments]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_createdAt_idx] ON [dbo].[inventory_stock_adjustments]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustment_lines_adjustmentId_idx] ON [dbo].[inventory_stock_adjustment_lines]([adjustmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustment_lines_productId_idx] ON [dbo].[inventory_stock_adjustment_lines]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustment_lines_movementId_idx] ON [dbo].[inventory_stock_adjustment_lines]([movementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_stock_adjustment_lines_adjustmentType_idx] ON [dbo].[inventory_stock_adjustment_lines]([adjustmentType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_failureCategory_idx] ON [dbo].[downtime_logs]([failureCategory]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_rcaStatus_idx] ON [dbo].[downtime_logs]([rcaStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_sla_rules_priority_idx] ON [dbo].[maintenance_sla_rules]([priority]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_sla_rules_type_idx] ON [dbo].[maintenance_sla_rules]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_sla_rules_isActive_idx] ON [dbo].[maintenance_sla_rules]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_sla_states_slaStatus_idx] ON [dbo].[maintenance_sla_states]([slaStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_sla_states_escalationLevel_idx] ON [dbo].[maintenance_sla_states]([escalationLevel]);

-- CreateIndex
ALTER TABLE [dbo].[maintenance_sla_states] ADD CONSTRAINT [maintenance_sla_states_maintenanceRequestId_key] UNIQUE NONCLUSTERED ([maintenanceRequestId]);

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_downtime_logs_rcaCompletedByUserId', 'downtime_logs_rcaCompletedByUserId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_required_part_approvedBy', 'maintenance_request_required_parts_approvedByUserId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_required_part_cancelledBy', 'maintenance_request_required_parts_cancelledByUserId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_required_part_failureCause', 'maintenance_request_required_parts_failureCauseId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_required_part_rejectedBy', 'maintenance_request_required_parts_rejectedByUserId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_required_part_requestedBy', 'maintenance_request_required_parts_requestedByUserId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_required_part_reservedBy', 'maintenance_request_required_parts_reservedByUserId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_required_part_usedBy', 'maintenance_request_required_parts_usedByUserId_fkey', 'OBJECT';

-- AddForeignKey
ALTER TABLE [dbo].[inventory_opening_balances] ADD CONSTRAINT [inventory_opening_balances_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_opening_balances] ADD CONSTRAINT [inventory_opening_balances_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_opening_balances] ADD CONSTRAINT [inventory_opening_balances_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_opening_balances] ADD CONSTRAINT [inventory_opening_balances_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_opening_balance_lines] ADD CONSTRAINT [inventory_opening_balance_lines_openingBalanceId_fkey] FOREIGN KEY ([openingBalanceId]) REFERENCES [dbo].[inventory_opening_balances]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_opening_balance_lines] ADD CONSTRAINT [inventory_opening_balance_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_opening_balance_lines] ADD CONSTRAINT [inventory_opening_balance_lines_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_stock_adjustments] ADD CONSTRAINT [inventory_stock_adjustments_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_stock_adjustments] ADD CONSTRAINT [inventory_stock_adjustments_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_stock_adjustments] ADD CONSTRAINT [inventory_stock_adjustments_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_stock_adjustments] ADD CONSTRAINT [inventory_stock_adjustments_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_stock_adjustment_lines] ADD CONSTRAINT [inventory_stock_adjustment_lines_adjustmentId_fkey] FOREIGN KEY ([adjustmentId]) REFERENCES [dbo].[inventory_stock_adjustments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_stock_adjustment_lines] ADD CONSTRAINT [inventory_stock_adjustment_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_stock_adjustment_lines] ADD CONSTRAINT [inventory_stock_adjustment_lines_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_required_parts] ADD CONSTRAINT [maintenance_request_required_parts_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_required_parts] ADD CONSTRAINT [maintenance_request_required_parts_lastIssueByUserId_fkey] FOREIGN KEY ([lastIssueByUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_sla_states] ADD CONSTRAINT [maintenance_sla_states_maintenanceRequestId_fkey] FOREIGN KEY ([maintenanceRequestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[operational_people] ADD CONSTRAINT [operational_people_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- RenameIndex
EXEC SP_RENAME N'dbo.maintenance_request_required_parts.idx_required_part_approvedBy', N'maintenance_request_required_parts_approvedByUserId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.maintenance_request_required_parts.idx_required_part_failureCause', N'maintenance_request_required_parts_failureCauseId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.maintenance_request_required_parts.idx_required_part_requestedBy', N'maintenance_request_required_parts_requestedByUserId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.maintenance_request_required_parts.idx_required_part_reservedBy', N'maintenance_request_required_parts_reservedByUserId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.maintenance_request_required_parts.idx_required_part_usedBy', N'maintenance_request_required_parts_usedByUserId_idx', N'INDEX';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

