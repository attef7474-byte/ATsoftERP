-- Complete maintenance execution workflow foundation (SQL Server 2016 compatible).
-- Existing data: preserves task/request/work-order IDs, timestamps, titles and historical links.
-- Nullable ownership is derived only from the historical Request's authoritative Machine.
-- No production data, migration ledger, global SparePart ownership or applicability catalogs are rewritten.
-- New work orders default to GENERAL; existing machine-linked orders become MACHINE.
-- New API writes must supply authorized tenant context; unresolved historical ownership remains NULL.
-- New supporting records are traceability/labor facts; InventoryMovement and valuation remain authoritative.
-- Recovery: this entire additive DDL/backfill/constraint batch is atomic. Any error rolls back all changes.
-- After a successful deployment, application rollback requires retaining this compatible additive schema;
-- removing populated new tables/columns requires a separately reviewed data-preserving migration.
-- Index impact: adds targeted source/tenant/session/usage lookups and one globally unique active-engineer
-- filtered index. Existing NVARCHAR(1000) ID widths are preserved; actual generated IDs are short.
-- Runtime compatibility: legacy request-backed tasks remain valid; new code requires this migration.
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[maintenance_tasks] ALTER COLUMN [requestId] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[maintenance_tasks] ADD [branchId] NVARCHAR(1000),
[companyId] NVARCHAR(1000),
[costCenterId] NVARCHAR(1000),
[createdById] NVARCHAR(1000),
[machineComponentId] NVARCHAR(1000),
[machineId] NVARCHAR(1000),
[productionLineId] NVARCHAR(1000),
[scopeType] NVARCHAR(32) NOT NULL CONSTRAINT [maintenance_tasks_scopeType_df] DEFAULT 'MACHINE',
[sourceType] NVARCHAR(32) NOT NULL CONSTRAINT [maintenance_tasks_sourceType_df] DEFAULT 'MAINTENANCE_REQUEST',
[workLocation] NVARCHAR(1000),
[workOrderId] NVARCHAR(1000);

-- AlterTable
ALTER TABLE [dbo].[downtime_logs] ADD [executionId] NVARCHAR(1000);

-- AlterTable
ALTER TABLE [dbo].[maintenance_work_orders] ADD [costCenterId] NVARCHAR(1000),
[productionLineId] NVARCHAR(1000),
[scopeType] NVARCHAR(32) NOT NULL CONSTRAINT [maintenance_work_orders_scopeType_df] DEFAULT 'GENERAL',
[workLocation] NVARCHAR(1000);

-- Backfill only from persisted authoritative relationships; never fabricate creator or labor sessions.
EXEC sp_executesql N'
UPDATE t
SET t.[sourceType] = N''MAINTENANCE_REQUEST'',
    t.[scopeType] = N''MACHINE'',
    t.[workOrderId] = NULL,
    t.[machineId] = r.[machineId],
    t.[productionLineId] = COALESCE(r.[productionLineId], m.[productionLineId]),
    t.[machineComponentId] = r.[machineComponentId],
    t.[costCenterId] = r.[costCenterId],
    t.[companyId] = m.[companyId],
    t.[branchId] = m.[branchId]
FROM [dbo].[maintenance_tasks] t
INNER JOIN [dbo].[maintenance_requests] r ON r.[id] = t.[requestId]
INNER JOIN [dbo].[machines] m ON m.[id] = r.[machineId];
IF EXISTS (SELECT 1 FROM [dbo].[maintenance_tasks] WHERE [machineId] IS NULL)
    THROW 51201, ''Historical maintenance task has no authoritative request machine; migration rolled back.'', 1;
UPDATE w
SET w.[scopeType] = CASE WHEN w.[machineId] IS NOT NULL THEN N''MACHINE'' ELSE N''GENERAL'' END,
    w.[productionLineId] = CASE WHEN w.[machineId] IS NOT NULL THEN m.[productionLineId] ELSE NULL END
FROM [dbo].[maintenance_work_orders] w
LEFT JOIN [dbo].[machines] m ON m.[id] = w.[machineId];
';

-- CreateTable
CREATE TABLE [dbo].[maintenance_execution_sessions] (
    [id] NVARCHAR(1000) NOT NULL,
    [executionId] NVARCHAR(1000) NOT NULL,
    [technicianUserId] NVARCHAR(1000) NOT NULL,
    [startedAt] DATETIME2 NOT NULL,
    [endedAt] DATETIME2,
    [workPerformed] NVARCHAR(max),
    [remainingWork] NVARCHAR(max),
    [endReason] NVARCHAR(32),
    [handoffToUserId] NVARCHAR(1000),
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_execution_sessions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_execution_sessions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_execution_part_usages] (
    [id] NVARCHAR(1000) NOT NULL,
    [executionId] NVARCHAR(1000) NOT NULL,
    [executionSessionId] NVARCHAR(1000),
    [sparePartId] NVARCHAR(1000),
    [productId] NVARCHAR(1000) NOT NULL,
    [quantity] DECIMAL(18,4) NOT NULL,
    [unit] NVARCHAR(1000),
    [usageType] NVARCHAR(32) NOT NULL,
    [inventoryMovementId] NVARCHAR(1000) NOT NULL,
    [recordedByUserId] NVARCHAR(1000) NOT NULL,
    [usedAt] DATETIME2 NOT NULL,
    [requiredPartId] NVARCHAR(1000),
    [workOrderPartId] NVARCHAR(1000),
    [installedPartId] NVARCHAR(1000),
    [replacementHistoryId] NVARCHAR(1000),
    [clientRequestId] NVARCHAR(100) NOT NULL,
    [requestFingerprint] NVARCHAR(64) NOT NULL,
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_execution_part_usages_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_execution_part_usages_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [maintenance_execution_part_usages_inventoryMovementId_key] UNIQUE NONCLUSTERED ([inventoryMovementId]),
    CONSTRAINT [maintenance_execution_part_usages_executionId_clientRequestId_key] UNIQUE NONCLUSTERED ([executionId],[clientRequestId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_sessions_executionId_endedAt_idx] ON [dbo].[maintenance_execution_sessions]([executionId], [endedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_sessions_technicianUserId_startedAt_idx] ON [dbo].[maintenance_execution_sessions]([technicianUserId], [startedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_sessions_handoffToUserId_idx] ON [dbo].[maintenance_execution_sessions]([handoffToUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_part_usages_executionSessionId_idx] ON [dbo].[maintenance_execution_part_usages]([executionSessionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_part_usages_sparePartId_idx] ON [dbo].[maintenance_execution_part_usages]([sparePartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_part_usages_productId_idx] ON [dbo].[maintenance_execution_part_usages]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_part_usages_recordedByUserId_idx] ON [dbo].[maintenance_execution_part_usages]([recordedByUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_part_usages_requiredPartId_idx] ON [dbo].[maintenance_execution_part_usages]([requiredPartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_part_usages_workOrderPartId_idx] ON [dbo].[maintenance_execution_part_usages]([workOrderPartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_part_usages_installedPartId_idx] ON [dbo].[maintenance_execution_part_usages]([installedPartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_part_usages_replacementHistoryId_idx] ON [dbo].[maintenance_execution_part_usages]([replacementHistoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_execution_part_usages_executionId_usedAt_idx] ON [dbo].[maintenance_execution_part_usages]([executionId], [usedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_workOrderId_idx] ON [dbo].[maintenance_tasks]([workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_createdById_idx] ON [dbo].[maintenance_tasks]([createdById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_machineId_idx] ON [dbo].[maintenance_tasks]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_productionLineId_idx] ON [dbo].[maintenance_tasks]([productionLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_machineComponentId_idx] ON [dbo].[maintenance_tasks]([machineComponentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_costCenterId_idx] ON [dbo].[maintenance_tasks]([costCenterId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_companyId_branchId_status_idx] ON [dbo].[maintenance_tasks]([companyId], [branchId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_sourceType_status_idx] ON [dbo].[maintenance_tasks]([sourceType], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_workOrderId_status_idx] ON [dbo].[maintenance_tasks]([workOrderId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_executionId_idx] ON [dbo].[downtime_logs]([executionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_work_orders_productionLineId_idx] ON [dbo].[maintenance_work_orders]([productionLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_work_orders_costCenterId_idx] ON [dbo].[maintenance_work_orders]([costCenterId]);

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[maintenance_work_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_machineComponentId_fkey] FOREIGN KEY ([machineComponentId]) REFERENCES [dbo].[machine_components]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_costCenterId_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_sessions] ADD CONSTRAINT [maintenance_execution_sessions_executionId_fkey] FOREIGN KEY ([executionId]) REFERENCES [dbo].[maintenance_tasks]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_sessions] ADD CONSTRAINT [maintenance_execution_sessions_technicianUserId_fkey] FOREIGN KEY ([technicianUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_sessions] ADD CONSTRAINT [maintenance_execution_sessions_handoffToUserId_fkey] FOREIGN KEY ([handoffToUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_executionId_fkey] FOREIGN KEY ([executionId]) REFERENCES [dbo].[maintenance_tasks]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_executionSessionId_fkey] FOREIGN KEY ([executionSessionId]) REFERENCES [dbo].[maintenance_execution_sessions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_sparePartId_fkey] FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_inventoryMovementId_fkey] FOREIGN KEY ([inventoryMovementId]) REFERENCES [dbo].[inventory_movements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_recordedByUserId_fkey] FOREIGN KEY ([recordedByUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_requiredPartId_fkey] FOREIGN KEY ([requiredPartId]) REFERENCES [dbo].[maintenance_request_required_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_workOrderPartId_fkey] FOREIGN KEY ([workOrderPartId]) REFERENCES [dbo].[maintenance_work_order_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_installedPartId_fkey] FOREIGN KEY ([installedPartId]) REFERENCES [dbo].[machine_installed_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_execution_part_usages] ADD CONSTRAINT [maintenance_execution_part_usages_replacementHistoryId_fkey] FOREIGN KEY ([replacementHistoryId]) REFERENCES [dbo].[spare_part_replacement_histories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_logs] ADD CONSTRAINT [downtime_logs_executionId_fkey] FOREIGN KEY ([executionId]) REFERENCES [dbo].[maintenance_tasks]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_work_orders] ADD CONSTRAINT [maintenance_work_orders_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_work_orders] ADD CONSTRAINT [maintenance_work_orders_costCenterId_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- SQL checks complement (and do not replace) tenant/machine/component validation in the API.
EXEC sp_executesql N'
ALTER TABLE [dbo].[maintenance_tasks] WITH CHECK ADD CONSTRAINT [maintenance_tasks_source_contract_ck] CHECK (
    ([sourceType] = N''MAINTENANCE_REQUEST'' AND [requestId] IS NOT NULL AND [workOrderId] IS NULL) OR
    ([sourceType] = N''WORK_ORDER'' AND [workOrderId] IS NOT NULL AND [requestId] IS NULL) OR
    ([sourceType] = N''DIRECT'' AND [requestId] IS NULL AND [workOrderId] IS NULL)
);
ALTER TABLE [dbo].[maintenance_tasks] WITH CHECK ADD CONSTRAINT [maintenance_tasks_scope_contract_ck] CHECK (
    ([scopeType] = N''MACHINE'' AND [machineId] IS NOT NULL) OR
    ([scopeType] = N''PRODUCTION_LINE'' AND [productionLineId] IS NOT NULL AND [machineId] IS NULL AND [machineComponentId] IS NULL) OR
    ([scopeType] = N''GENERAL'' AND [productionLineId] IS NULL AND [machineId] IS NULL AND [machineComponentId] IS NULL)
);
ALTER TABLE [dbo].[maintenance_tasks] WITH CHECK ADD CONSTRAINT [maintenance_tasks_chronology_ck] CHECK (
    [completedAt] IS NULL OR ([startedAt] IS NOT NULL AND [completedAt] >= [startedAt])
);
ALTER TABLE [dbo].[maintenance_work_orders] WITH CHECK ADD CONSTRAINT [maintenance_work_orders_scope_contract_ck] CHECK (
    ([scopeType] = N''MACHINE'' AND [machineId] IS NOT NULL) OR
    ([scopeType] = N''PRODUCTION_LINE'' AND [productionLineId] IS NOT NULL AND [machineId] IS NULL AND [machineComponentId] IS NULL) OR
    ([scopeType] = N''GENERAL'' AND [productionLineId] IS NULL AND [machineId] IS NULL AND [machineComponentId] IS NULL)
);
';
ALTER TABLE [dbo].[maintenance_execution_sessions] WITH CHECK ADD CONSTRAINT [maintenance_execution_sessions_chronology_ck] CHECK (
    [endedAt] IS NULL OR [endedAt] >= [startedAt]
);
ALTER TABLE [dbo].[maintenance_execution_sessions] WITH CHECK ADD CONSTRAINT [maintenance_execution_sessions_end_reason_ck] CHECK (
    ([endedAt] IS NULL AND [endReason] IS NULL) OR
    ([endedAt] IS NOT NULL AND [endReason] IN (N'HANDOFF', N'PAUSE', N'LEAVE', N'COMPLETE'))
);
ALTER TABLE [dbo].[maintenance_execution_part_usages] WITH CHECK ADD CONSTRAINT [maintenance_execution_part_usages_quantity_ck] CHECK ([quantity] > 0);
ALTER TABLE [dbo].[maintenance_execution_part_usages] WITH CHECK ADD CONSTRAINT [maintenance_execution_part_usages_type_ck] CHECK (
    [usageType] IN (N'CONSUMED', N'INSTALLED', N'REPLACED')
);
ALTER TABLE [dbo].[maintenance_execution_part_usages] WITH CHECK ADD CONSTRAINT [maintenance_execution_part_usages_install_trace_ck] CHECK (
    ([usageType] = N'CONSUMED' AND [installedPartId] IS NULL AND [replacementHistoryId] IS NULL) OR
    ([usageType] = N'INSTALLED' AND [replacementHistoryId] IS NULL) OR [usageType] = N'REPLACED'
);
ALTER TABLE [dbo].[maintenance_execution_part_usages] WITH CHECK ADD CONSTRAINT [maintenance_execution_part_usages_source_line_ck] CHECK (
    [requiredPartId] IS NULL OR [workOrderPartId] IS NULL
);
CREATE UNIQUE NONCLUSTERED INDEX [maintenance_execution_sessions_one_active_technician_key]
ON [dbo].[maintenance_execution_sessions]([technicianUserId]) WHERE [endedAt] IS NULL;

-- MAINTENANCE_EXECUTION_MIGRATION_COMMIT (late-failure proof injection point)
COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
