BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[maintenance_request_part_usages] (
    [id] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [quantity] FLOAT(53) NOT NULL,
    [unitCost] FLOAT(53),
    [totalCost] FLOAT(53),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_request_part_usages_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_request_part_usages_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_request_cost_entries] (
    [id] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [amount] FLOAT(53) NOT NULL,
    [incurredAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_request_cost_entries_incurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_request_cost_entries_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_request_cost_entries_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_checklist_executions] (
    [id] NVARCHAR(1000) NOT NULL,
    [scheduleId] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_checklist_executions_status_df] DEFAULT 'IN_PROGRESS',
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_checklist_executions_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [completedAt] DATETIME2,
    [completedById] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_checklist_executions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_checklist_executions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_checklist_execution_items] (
    [id] NVARCHAR(1000) NOT NULL,
    [executionId] NVARCHAR(1000) NOT NULL,
    [checklistItemId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_checklist_execution_items_status_df] DEFAULT 'PENDING',
    [passed] BIT,
    [notes] NVARCHAR(1000),
    [completedAt] DATETIME2,
    [completedById] NVARCHAR(1000),
    CONSTRAINT [maintenance_checklist_execution_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_part_usages_requestId_idx] ON [dbo].[maintenance_request_part_usages]([requestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_part_usages_productId_idx] ON [dbo].[maintenance_request_part_usages]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_cost_entries_requestId_idx] ON [dbo].[maintenance_request_cost_entries]([requestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_checklist_executions_scheduleId_idx] ON [dbo].[maintenance_checklist_executions]([scheduleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_checklist_executions_requestId_idx] ON [dbo].[maintenance_checklist_executions]([requestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_checklist_executions_status_idx] ON [dbo].[maintenance_checklist_executions]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_checklist_executions_scheduleId_status_idx] ON [dbo].[maintenance_checklist_executions]([scheduleId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_checklist_executions_requestId_status_idx] ON [dbo].[maintenance_checklist_executions]([requestId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_checklist_execution_items_executionId_idx] ON [dbo].[maintenance_checklist_execution_items]([executionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_checklist_execution_items_checklistItemId_idx] ON [dbo].[maintenance_checklist_execution_items]([checklistItemId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_entity_entityId_idx] ON [dbo].[audit_logs]([entity], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_userId_action_idx] ON [dbo].[audit_logs]([userId], [action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_entity_createdAt_idx] ON [dbo].[audit_logs]([entity], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_label_templates_status_entityType_idx] ON [dbo].[barcode_label_templates]([status], [entityType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_entityType_entityId_status_idx] ON [dbo].[barcode_labels]([entityType], [entityId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_status_createdAt_idx] ON [dbo].[barcode_labels]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_labelId_result_idx] ON [dbo].[barcode_scan_events]([labelId], [result]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_scannedById_scannedAt_idx] ON [dbo].[barcode_scan_events]([scannedById], [scannedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [branches_status_idx] ON [dbo].[branches]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [branches_createdAt_idx] ON [dbo].[branches]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [companies_status_idx] ON [dbo].[companies]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [companies_code_idx] ON [dbo].[companies]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [companies_createdAt_idx] ON [dbo].[companies]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [departments_branchId_idx] ON [dbo].[departments]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [departments_status_idx] ON [dbo].[departments]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [departments_createdAt_idx] ON [dbo].[departments]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_machineId_startTime_idx] ON [dbo].[downtime_logs]([machineId], [startTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_requestId_cancelledAt_idx] ON [dbo].[downtime_logs]([requestId], [cancelledAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_endTime_cancelledAt_idx] ON [dbo].[downtime_logs]([endTime], [cancelledAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustment_lines_adjustmentId_productId_idx] ON [dbo].[inventory_adjustment_lines]([adjustmentId], [productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_adjustmentNumber_idx] ON [dbo].[inventory_adjustments]([adjustmentNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_createdAt_idx] ON [dbo].[inventory_adjustments]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_warehouseId_status_idx] ON [dbo].[inventory_adjustments]([warehouseId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_status_adjustmentDate_idx] ON [dbo].[inventory_adjustments]([status], [adjustmentDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_balances_quantity_idx] ON [dbo].[inventory_balances]([quantity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_balances_updatedAt_idx] ON [dbo].[inventory_balances]([updatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_balances_warehouseId_productId_idx] ON [dbo].[inventory_balances]([warehouseId], [productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_count_lines_countId_status_idx] ON [dbo].[inventory_count_lines]([countId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_count_lines_countId_productId_idx] ON [dbo].[inventory_count_lines]([countId], [productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_counts_countNumber_idx] ON [dbo].[inventory_counts]([countNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_counts_createdAt_idx] ON [dbo].[inventory_counts]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_counts_warehouseId_status_idx] ON [dbo].[inventory_counts]([warehouseId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_counts_status_createdAt_idx] ON [dbo].[inventory_counts]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movement_lines_movementId_productId_idx] ON [dbo].[inventory_movement_lines]([movementId], [productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_movementNumber_idx] ON [dbo].[inventory_movements]([movementNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_createdAt_idx] ON [dbo].[inventory_movements]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_warehouseId_status_idx] ON [dbo].[inventory_movements]([warehouseId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_status_movementDate_idx] ON [dbo].[inventory_movements]([status], [movementDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_categories_parentId_idx] ON [dbo].[machine_categories]([parentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_categories_status_idx] ON [dbo].[machine_categories]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_parts_code_idx] ON [dbo].[machine_parts]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_parts_name_idx] ON [dbo].[machine_parts]([name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_code_idx] ON [dbo].[machines]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_createdAt_idx] ON [dbo].[machines]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_status_categoryId_idx] ON [dbo].[machines]([status], [categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_companyId_status_idx] ON [dbo].[machines]([companyId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_createdAt_idx] ON [dbo].[maintenance_requests]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_status_priority_idx] ON [dbo].[maintenance_requests]([status], [priority]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_machineId_status_idx] ON [dbo].[maintenance_requests]([machineId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_assignedToId_status_idx] ON [dbo].[maintenance_requests]([assignedToId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_status_createdAt_idx] ON [dbo].[maintenance_requests]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_schedules_machineId_status_idx] ON [dbo].[maintenance_schedules]([machineId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_schedules_startDate_idx] ON [dbo].[maintenance_schedules]([startDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_schedules_endDate_idx] ON [dbo].[maintenance_schedules]([endDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_requestId_status_idx] ON [dbo].[maintenance_tasks]([requestId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_assignedToId_status_idx] ON [dbo].[maintenance_tasks]([assignedToId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_completedAt_idx] ON [dbo].[maintenance_tasks]([completedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_userId_read_idx] ON [dbo].[notifications]([userId], [read]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_userId_createdAt_idx] ON [dbo].[notifications]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_read_createdAt_idx] ON [dbo].[notifications]([read], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [permissions_module_idx] ON [dbo].[permissions]([module]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [permissions_action_idx] ON [dbo].[permissions]([action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [permissions_module_action_idx] ON [dbo].[permissions]([module], [action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [permissions_status_idx] ON [dbo].[permissions]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [product_categories_parentId_idx] ON [dbo].[product_categories]([parentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [product_categories_status_idx] ON [dbo].[product_categories]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [products_code_idx] ON [dbo].[products]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [products_name_idx] ON [dbo].[products]([name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [products_createdAt_idx] ON [dbo].[products]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [products_categoryId_status_idx] ON [dbo].[products]([categoryId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [products_status_createdAt_idx] ON [dbo].[products]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [role_permissions_roleId_idx] ON [dbo].[role_permissions]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [role_permissions_permissionId_idx] ON [dbo].[role_permissions]([permissionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [roles_code_idx] ON [dbo].[roles]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [roles_status_idx] ON [dbo].[roles]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [user_roles_userId_idx] ON [dbo].[user_roles]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [user_roles_roleId_idx] ON [dbo].[user_roles]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_email_idx] ON [dbo].[users]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_status_idx] ON [dbo].[users]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_name_idx] ON [dbo].[users]([name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_companyId_idx] ON [dbo].[users]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_branchId_idx] ON [dbo].[users]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_departmentId_idx] ON [dbo].[users]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_status_createdAt_idx] ON [dbo].[users]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [warehouse_locations_status_idx] ON [dbo].[warehouse_locations]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [warehouse_locations_barcode_idx] ON [dbo].[warehouse_locations]([barcode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [warehouses_branchId_idx] ON [dbo].[warehouses]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [warehouses_status_idx] ON [dbo].[warehouses]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [warehouses_createdAt_idx] ON [dbo].[warehouses]([createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_part_usages] ADD CONSTRAINT [maintenance_request_part_usages_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_part_usages] ADD CONSTRAINT [maintenance_request_part_usages_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_cost_entries] ADD CONSTRAINT [maintenance_request_cost_entries_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_checklist_executions] ADD CONSTRAINT [maintenance_checklist_executions_scheduleId_fkey] FOREIGN KEY ([scheduleId]) REFERENCES [dbo].[maintenance_schedules]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_checklist_executions] ADD CONSTRAINT [maintenance_checklist_executions_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_checklist_executions] ADD CONSTRAINT [maintenance_checklist_executions_completedById_fkey] FOREIGN KEY ([completedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_checklist_execution_items] ADD CONSTRAINT [maintenance_checklist_execution_items_executionId_fkey] FOREIGN KEY ([executionId]) REFERENCES [dbo].[maintenance_checklist_executions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_checklist_execution_items] ADD CONSTRAINT [maintenance_checklist_execution_items_checklistItemId_fkey] FOREIGN KEY ([checklistItemId]) REFERENCES [dbo].[maintenance_checklist_items]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_checklist_execution_items] ADD CONSTRAINT [maintenance_checklist_execution_items_completedById_fkey] FOREIGN KEY ([completedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
