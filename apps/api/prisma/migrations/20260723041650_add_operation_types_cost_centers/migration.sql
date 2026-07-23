BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[operation_types] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [operation_types_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [operation_types_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [operation_types_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [operation_types_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[cost_centers] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [type] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000),
    [branchId] NVARCHAR(1000),
    [administrationId] NVARCHAR(1000),
    [departmentId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [cost_centers_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [cost_centers_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [cost_centers_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [cost_centers_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [operation_types_code_idx] ON [dbo].[operation_types]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [operation_types_status_idx] ON [dbo].[operation_types]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [operation_types_status_createdAt_idx] ON [dbo].[operation_types]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cost_centers_code_idx] ON [dbo].[cost_centers]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cost_centers_type_idx] ON [dbo].[cost_centers]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cost_centers_companyId_idx] ON [dbo].[cost_centers]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cost_centers_branchId_idx] ON [dbo].[cost_centers]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cost_centers_administrationId_idx] ON [dbo].[cost_centers]([administrationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cost_centers_departmentId_idx] ON [dbo].[cost_centers]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cost_centers_status_idx] ON [dbo].[cost_centers]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cost_centers_type_status_idx] ON [dbo].[cost_centers]([type], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cost_centers_companyId_status_idx] ON [dbo].[cost_centers]([companyId], [status]);

-- AddForeignKey
ALTER TABLE [dbo].[cost_centers] ADD CONSTRAINT [cost_centers_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[cost_centers] ADD CONSTRAINT [cost_centers_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[cost_centers] ADD CONSTRAINT [cost_centers_administrationId_fkey] FOREIGN KEY ([administrationId]) REFERENCES [dbo].[administrations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[cost_centers] ADD CONSTRAINT [cost_centers_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
