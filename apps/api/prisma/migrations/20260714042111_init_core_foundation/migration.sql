BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[companies] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [legalName] NVARCHAR(1000),
    [taxNumber] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [logo] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [companies_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [companies_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [companies_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [companies_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[branches] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [branches_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [branches_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [branches_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [branches_companyId_code_key] UNIQUE NONCLUSTERED ([companyId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[departments] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [parentId] NVARCHAR(1000),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [departments_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [departments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [departments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [departments_companyId_code_key] UNIQUE NONCLUSTERED ([companyId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000),
    [avatar] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [users_status_df] DEFAULT 'ACTIVE',
    [companyId] NVARCHAR(1000),
    [branchId] NVARCHAR(1000),
    [departmentId] NVARCHAR(1000),
    [twoFactorEnabled] BIT NOT NULL CONSTRAINT [users_twoFactorEnabled_df] DEFAULT 0,
    [twoFactorSecret] NVARCHAR(1000),
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [users_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[roles] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isSystem] BIT NOT NULL CONSTRAINT [roles_isSystem_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [roles_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [roles_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [roles_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[permissions] (
    [id] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [module] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [permissions_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [permissions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [permissions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [permissions_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[user_roles] (
    [userId] NVARCHAR(1000) NOT NULL,
    [roleId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [user_roles_pkey] PRIMARY KEY CLUSTERED ([userId],[roleId])
);

-- CreateTable
CREATE TABLE [dbo].[role_permissions] (
    [roleId] NVARCHAR(1000) NOT NULL,
    [permissionId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [role_permissions_pkey] PRIMARY KEY CLUSTERED ([roleId],[permissionId])
);

-- CreateTable
CREATE TABLE [dbo].[audit_logs] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000),
    [action] NVARCHAR(1000) NOT NULL,
    [entity] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000),
    [details] NVARCHAR(1000),
    [ip] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [audit_logs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [notifications_type_df] DEFAULT 'INFO',
    [read] BIT NOT NULL CONSTRAINT [notifications_read_df] DEFAULT 0,
    [link] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [notifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [notifications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[attachments] (
    [id] NVARCHAR(1000) NOT NULL,
    [entityName] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [originalName] NVARCHAR(1000) NOT NULL,
    [filePath] NVARCHAR(1000) NOT NULL,
    [mimeType] NVARCHAR(1000) NOT NULL,
    [size] INT NOT NULL,
    [uploadedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [attachments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [attachments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[system_settings] (
    [id] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [group] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [system_settings_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [system_settings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [system_settings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [system_settings_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[number_sequences] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [prefix] NVARCHAR(1000) NOT NULL,
    [suffix] NVARCHAR(1000),
    [currentNumber] INT NOT NULL CONSTRAINT [number_sequences_currentNumber_df] DEFAULT 0,
    [padding] INT NOT NULL CONSTRAINT [number_sequences_padding_df] DEFAULT 6,
    [scope] NVARCHAR(1000) NOT NULL CONSTRAINT [number_sequences_scope_df] DEFAULT 'GLOBAL',
    [companyId] NVARCHAR(1000),
    [branchId] NVARCHAR(1000),
    [resetPolicy] NVARCHAR(1000) NOT NULL CONSTRAINT [number_sequences_resetPolicy_df] DEFAULT 'NEVER',
    [lastResetAt] DATETIME2,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [number_sequences_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [number_sequences_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [number_sequences_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [number_sequences_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[warehouses] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [location] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [warehouses_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [warehouses_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [warehouses_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [warehouses_companyId_code_key] UNIQUE NONCLUSTERED ([companyId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[warehouse_locations] (
    [id] NVARCHAR(1000) NOT NULL,
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [barcode] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [warehouse_locations_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [warehouse_locations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [warehouse_locations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [warehouse_locations_warehouseId_code_key] UNIQUE NONCLUSTERED ([warehouseId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[product_categories] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [parentId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [product_categories_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [product_categories_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [product_categories_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [product_categories_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[products] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [categoryId] NVARCHAR(1000),
    [unit] NVARCHAR(1000) NOT NULL,
    [barcode] NVARCHAR(1000),
    [qrCode] NVARCHAR(1000),
    [image] NVARCHAR(1000),
    [minStock] FLOAT(53) NOT NULL CONSTRAINT [products_minStock_df] DEFAULT 0,
    [maxStock] FLOAT(53) NOT NULL CONSTRAINT [products_maxStock_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [products_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [products_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [products_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [products_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_balances] (
    [id] NVARCHAR(1000) NOT NULL,
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [locationId] NVARCHAR(1000),
    [productId] NVARCHAR(1000) NOT NULL,
    [quantity] FLOAT(53) NOT NULL CONSTRAINT [inventory_balances_quantity_df] DEFAULT 0,
    [batchNumber] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [expiryDate] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_balances_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [inventory_balances_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_balances_warehouseId_productId_batchNumber_serialNumber_key] UNIQUE NONCLUSTERED ([warehouseId],[productId],[batchNumber],[serialNumber])
);

-- CreateTable
CREATE TABLE [dbo].[machine_categories] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [parentId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [machine_categories_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [machine_categories_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [machine_categories_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [machine_categories_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[machines] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [categoryId] NVARCHAR(1000),
    [companyId] NVARCHAR(1000),
    [branchId] NVARCHAR(1000),
    [departmentId] NVARCHAR(1000),
    [model] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [manufacturer] NVARCHAR(1000),
    [purchaseDate] DATETIME2,
    [warrantyEnd] DATETIME2,
    [location] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [machines_status_df] DEFAULT 'ACTIVE',
    [qrCode] NVARCHAR(1000),
    [image] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [machines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [machines_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [machines_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[machine_parts] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000),
    [productId] NVARCHAR(1000),
    [partNumber] NVARCHAR(1000),
    [quantity] FLOAT(53) NOT NULL CONSTRAINT [machine_parts_quantity_df] DEFAULT 0,
    [minStock] FLOAT(53) NOT NULL CONSTRAINT [machine_parts_minStock_df] DEFAULT 0,
    [unit] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [machine_parts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [machine_parts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [machine_parts_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[machine_documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [fileUrl] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [machine_documents_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [machine_documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_requests] (
    [id] NVARCHAR(1000) NOT NULL,
    [requestNumber] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [priority] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_requests_priority_df] DEFAULT 'MEDIUM',
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_requests_status_df] DEFAULT 'OPEN',
    [requestedById] NVARCHAR(1000),
    [assignedToId] NVARCHAR(1000),
    [startDate] DATETIME2,
    [endDate] DATETIME2,
    [downtimeHours] FLOAT(53),
    [cost] FLOAT(53),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_requests_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [maintenance_requests_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [maintenance_requests_requestNumber_key] UNIQUE NONCLUSTERED ([requestNumber])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_tasks] (
    [id] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_tasks_status_df] DEFAULT 'PENDING',
    [assignedToId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_tasks_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_tasks_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_schedules] (
    [id] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000),
    [type] NVARCHAR(1000) NOT NULL,
    [frequency] NVARCHAR(1000) NOT NULL,
    [intervalDays] INT,
    [startDate] DATETIME2 NOT NULL,
    [endDate] DATETIME2,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_schedules_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_schedules_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_schedules_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_checklist_items] (
    [id] NVARCHAR(1000) NOT NULL,
    [scheduleId] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [sortOrder] INT NOT NULL CONSTRAINT [maintenance_checklist_items_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_checklist_items_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_checklist_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[downtime_logs] (
    [id] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000),
    [startTime] DATETIME2 NOT NULL,
    [endTime] DATETIME2,
    [durationMinutes] FLOAT(53),
    [reason] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [downtime_logs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [downtime_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_userId_idx] ON [dbo].[audit_logs]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_entity_idx] ON [dbo].[audit_logs]([entity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_entityId_idx] ON [dbo].[audit_logs]([entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_action_idx] ON [dbo].[audit_logs]([action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_createdAt_idx] ON [dbo].[audit_logs]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_userId_idx] ON [dbo].[notifications]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_read_idx] ON [dbo].[notifications]([read]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_createdAt_idx] ON [dbo].[notifications]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [attachments_entityName_idx] ON [dbo].[attachments]([entityName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [attachments_entityId_idx] ON [dbo].[attachments]([entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_settings_group_idx] ON [dbo].[system_settings]([group]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [products_categoryId_idx] ON [dbo].[products]([categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [products_status_idx] ON [dbo].[products]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_balances_warehouseId_idx] ON [dbo].[inventory_balances]([warehouseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_balances_productId_idx] ON [dbo].[inventory_balances]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_balances_locationId_idx] ON [dbo].[inventory_balances]([locationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_categoryId_idx] ON [dbo].[machines]([categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_companyId_idx] ON [dbo].[machines]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_branchId_idx] ON [dbo].[machines]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_departmentId_idx] ON [dbo].[machines]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_status_idx] ON [dbo].[machines]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_parts_machineId_idx] ON [dbo].[machine_parts]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_parts_productId_idx] ON [dbo].[machine_parts]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_documents_machineId_idx] ON [dbo].[machine_documents]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_machineId_idx] ON [dbo].[maintenance_requests]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_status_idx] ON [dbo].[maintenance_requests]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_type_idx] ON [dbo].[maintenance_requests]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_priority_idx] ON [dbo].[maintenance_requests]([priority]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_requestedById_idx] ON [dbo].[maintenance_requests]([requestedById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_assignedToId_idx] ON [dbo].[maintenance_requests]([assignedToId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_requestNumber_idx] ON [dbo].[maintenance_requests]([requestNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_requestId_idx] ON [dbo].[maintenance_tasks]([requestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_assignedToId_idx] ON [dbo].[maintenance_tasks]([assignedToId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_tasks_status_idx] ON [dbo].[maintenance_tasks]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_schedules_machineId_idx] ON [dbo].[maintenance_schedules]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_schedules_status_idx] ON [dbo].[maintenance_schedules]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_schedules_type_idx] ON [dbo].[maintenance_schedules]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_checklist_items_scheduleId_idx] ON [dbo].[maintenance_checklist_items]([scheduleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_machineId_idx] ON [dbo].[downtime_logs]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_requestId_idx] ON [dbo].[downtime_logs]([requestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_startTime_idx] ON [dbo].[downtime_logs]([startTime]);

-- AddForeignKey
ALTER TABLE [dbo].[branches] ADD CONSTRAINT [branches_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[departments] ADD CONSTRAINT [departments_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[departments] ADD CONSTRAINT [departments_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[departments] ADD CONSTRAINT [departments_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[roles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[role_permissions] ADD CONSTRAINT [role_permissions_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[roles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[role_permissions] ADD CONSTRAINT [role_permissions_permissionId_fkey] FOREIGN KEY ([permissionId]) REFERENCES [dbo].[permissions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_logs] ADD CONSTRAINT [audit_logs_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[notifications] ADD CONSTRAINT [notifications_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[attachments] ADD CONSTRAINT [attachments_uploadedById_fkey] FOREIGN KEY ([uploadedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[number_sequences] ADD CONSTRAINT [number_sequences_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[warehouses] ADD CONSTRAINT [warehouses_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[warehouses] ADD CONSTRAINT [warehouses_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[warehouse_locations] ADD CONSTRAINT [warehouse_locations_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[product_categories] ADD CONSTRAINT [product_categories_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[product_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[products] ADD CONSTRAINT [products_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[product_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_balances] ADD CONSTRAINT [inventory_balances_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_balances] ADD CONSTRAINT [inventory_balances_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_balances] ADD CONSTRAINT [inventory_balances_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_categories] ADD CONSTRAINT [machine_categories_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[machine_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machines] ADD CONSTRAINT [machines_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[machine_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machines] ADD CONSTRAINT [machines_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machines] ADD CONSTRAINT [machines_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machines] ADD CONSTRAINT [machines_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_parts] ADD CONSTRAINT [machine_parts_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_parts] ADD CONSTRAINT [machine_parts_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_documents] ADD CONSTRAINT [machine_documents_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_requests] ADD CONSTRAINT [maintenance_requests_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_requests] ADD CONSTRAINT [maintenance_requests_requestedById_fkey] FOREIGN KEY ([requestedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_requests] ADD CONSTRAINT [maintenance_requests_assignedToId_fkey] FOREIGN KEY ([assignedToId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_tasks] ADD CONSTRAINT [maintenance_tasks_assignedToId_fkey] FOREIGN KEY ([assignedToId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_schedules] ADD CONSTRAINT [maintenance_schedules_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_schedules] ADD CONSTRAINT [maintenance_schedules_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_checklist_items] ADD CONSTRAINT [maintenance_checklist_items_scheduleId_fkey] FOREIGN KEY ([scheduleId]) REFERENCES [dbo].[maintenance_schedules]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_logs] ADD CONSTRAINT [downtime_logs_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_logs] ADD CONSTRAINT [downtime_logs_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
