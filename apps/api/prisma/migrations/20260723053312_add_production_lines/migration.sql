BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[production_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [location] NVARCHAR(1000),
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [administrationId] NVARCHAR(1000),
    [departmentId] NVARCHAR(1000) NOT NULL,
    [operationTypeId] NVARCHAR(1000) NOT NULL,
    [costCenterId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_lines_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [production_lines_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_lines_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_lines_code_idx] ON [dbo].[production_lines]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_lines_companyId_idx] ON [dbo].[production_lines]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_lines_branchId_idx] ON [dbo].[production_lines]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_lines_administrationId_idx] ON [dbo].[production_lines]([administrationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_lines_departmentId_idx] ON [dbo].[production_lines]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_lines_operationTypeId_idx] ON [dbo].[production_lines]([operationTypeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_lines_costCenterId_idx] ON [dbo].[production_lines]([costCenterId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_lines_status_idx] ON [dbo].[production_lines]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_lines_companyId_status_idx] ON [dbo].[production_lines]([companyId], [status]);

-- AddForeignKey
ALTER TABLE [dbo].[production_lines] ADD CONSTRAINT [production_lines_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_lines] ADD CONSTRAINT [production_lines_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_lines] ADD CONSTRAINT [production_lines_administrationId_fkey] FOREIGN KEY ([administrationId]) REFERENCES [dbo].[administrations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_lines] ADD CONSTRAINT [production_lines_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_lines] ADD CONSTRAINT [production_lines_operationTypeId_fkey] FOREIGN KEY ([operationTypeId]) REFERENCES [dbo].[operation_types]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_lines] ADD CONSTRAINT [production_lines_costCenterId_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
