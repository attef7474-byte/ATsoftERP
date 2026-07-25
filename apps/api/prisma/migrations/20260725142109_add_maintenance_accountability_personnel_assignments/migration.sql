BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[maintenance_personnel] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [specialty] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [userId] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [maintenance_personnel_isActive_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_personnel_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_personnel_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [maintenance_personnel_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[machine_responsibility_assignments] (
    [id] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000) NOT NULL,
    [maintenancePersonnelId] NVARCHAR(1000) NOT NULL,
    [responsibilityRole] NVARCHAR(1000) NOT NULL,
    [isPrimary] BIT NOT NULL CONSTRAINT [machine_responsibility_assignments_isPrimary_df] DEFAULT 0,
    [startDate] DATETIME2 NOT NULL,
    [endDate] DATETIME2,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [machine_responsibility_assignments_status_df] DEFAULT 'ACTIVE',
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [machine_responsibility_assignments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [machine_responsibility_assignments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_request_assignments] (
    [id] NVARCHAR(1000) NOT NULL,
    [maintenanceRequestId] NVARCHAR(1000) NOT NULL,
    [maintenancePersonnelId] NVARCHAR(1000) NOT NULL,
    [assignmentRole] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_request_assignments_status_df] DEFAULT 'ASSIGNED',
    [assignedAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_request_assignments_assignedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [acceptedAt] DATETIME2,
    [startedAt] DATETIME2,
    [completedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_request_assignments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_request_assignments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[maintenance_part_accountability] (
    [id] NVARCHAR(1000) NOT NULL,
    [maintenanceRequestId] NVARCHAR(1000) NOT NULL,
    [requiredPartId] NVARCHAR(1000) NOT NULL,
    [sparePartId] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000),
    [machineComponentId] NVARCHAR(1000),
    [maintenancePersonnelId] NVARCHAR(1000) NOT NULL,
    [quantity] FLOAT(53) NOT NULL,
    [reportedUsedQuantity] FLOAT(53),
    [returnedQuantity] FLOAT(53),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_part_accountability_status_df] DEFAULT 'ASSIGNED',
    [accountabilityNote] NVARCHAR(1000),
    [assignedAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_part_accountability_assignedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [reportedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_part_accountability_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_part_accountability_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_personnel_code_idx] ON [dbo].[maintenance_personnel]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_personnel_role_idx] ON [dbo].[maintenance_personnel]([role]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_personnel_specialty_idx] ON [dbo].[maintenance_personnel]([specialty]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_personnel_isActive_idx] ON [dbo].[maintenance_personnel]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_personnel_userId_idx] ON [dbo].[maintenance_personnel]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_responsibility_assignments_machineId_idx] ON [dbo].[machine_responsibility_assignments]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_responsibility_assignments_maintenancePersonnelId_idx] ON [dbo].[machine_responsibility_assignments]([maintenancePersonnelId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_responsibility_assignments_responsibilityRole_idx] ON [dbo].[machine_responsibility_assignments]([responsibilityRole]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_responsibility_assignments_isPrimary_idx] ON [dbo].[machine_responsibility_assignments]([isPrimary]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_responsibility_assignments_status_idx] ON [dbo].[machine_responsibility_assignments]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_responsibility_assignments_machineId_maintenancePersonnelId_status_idx] ON [dbo].[machine_responsibility_assignments]([machineId], [maintenancePersonnelId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_assignments_maintenanceRequestId_idx] ON [dbo].[maintenance_request_assignments]([maintenanceRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_assignments_maintenancePersonnelId_idx] ON [dbo].[maintenance_request_assignments]([maintenancePersonnelId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_assignments_assignmentRole_idx] ON [dbo].[maintenance_request_assignments]([assignmentRole]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_assignments_status_idx] ON [dbo].[maintenance_request_assignments]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_assignments_maintenanceRequestId_maintenancePersonnelId_status_idx] ON [dbo].[maintenance_request_assignments]([maintenanceRequestId], [maintenancePersonnelId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_part_accountability_maintenanceRequestId_idx] ON [dbo].[maintenance_part_accountability]([maintenanceRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_part_accountability_requiredPartId_idx] ON [dbo].[maintenance_part_accountability]([requiredPartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_part_accountability_sparePartId_idx] ON [dbo].[maintenance_part_accountability]([sparePartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_part_accountability_machineId_idx] ON [dbo].[maintenance_part_accountability]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_part_accountability_machineComponentId_idx] ON [dbo].[maintenance_part_accountability]([machineComponentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_part_accountability_maintenancePersonnelId_idx] ON [dbo].[maintenance_part_accountability]([maintenancePersonnelId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_part_accountability_status_idx] ON [dbo].[maintenance_part_accountability]([status]);

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_personnel] ADD CONSTRAINT [maintenance_personnel_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_responsibility_assignments] ADD CONSTRAINT [machine_responsibility_assignments_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_responsibility_assignments] ADD CONSTRAINT [machine_responsibility_assignments_maintenancePersonnelId_fkey] FOREIGN KEY ([maintenancePersonnelId]) REFERENCES [dbo].[maintenance_personnel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_assignments] ADD CONSTRAINT [maintenance_request_assignments_maintenanceRequestId_fkey] FOREIGN KEY ([maintenanceRequestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_assignments] ADD CONSTRAINT [maintenance_request_assignments_maintenancePersonnelId_fkey] FOREIGN KEY ([maintenancePersonnelId]) REFERENCES [dbo].[maintenance_personnel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_part_accountability] ADD CONSTRAINT [maintenance_part_accountability_maintenanceRequestId_fkey] FOREIGN KEY ([maintenanceRequestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_part_accountability] ADD CONSTRAINT [maintenance_part_accountability_requiredPartId_fkey] FOREIGN KEY ([requiredPartId]) REFERENCES [dbo].[maintenance_request_required_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_part_accountability] ADD CONSTRAINT [maintenance_part_accountability_sparePartId_fkey] FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_part_accountability] ADD CONSTRAINT [maintenance_part_accountability_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_part_accountability] ADD CONSTRAINT [maintenance_part_accountability_machineComponentId_fkey] FOREIGN KEY ([machineComponentId]) REFERENCES [dbo].[machine_components]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_part_accountability] ADD CONSTRAINT [maintenance_part_accountability_maintenancePersonnelId_fkey] FOREIGN KEY ([maintenancePersonnelId]) REFERENCES [dbo].[maintenance_personnel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
