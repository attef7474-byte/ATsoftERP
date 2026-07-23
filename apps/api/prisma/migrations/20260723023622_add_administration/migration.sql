BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[departments] ADD [administrationId] NVARCHAR(1000);

-- AlterTable
ALTER TABLE [dbo].[number_sequences] DROP CONSTRAINT [number_sequences_domain_df],
[number_sequences_modelName_df],
[number_sequences_operationName_df];

-- CreateTable
CREATE TABLE [dbo].[administrations] (
    [id] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [administrations_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [administrations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [administrations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [administrations_branchId_code_key] UNIQUE NONCLUSTERED ([branchId],[code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [administrations_branchId_idx] ON [dbo].[administrations]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [administrations_status_idx] ON [dbo].[administrations]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [administrations_createdAt_idx] ON [dbo].[administrations]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [departments_administrationId_idx] ON [dbo].[departments]([administrationId]);

-- AddForeignKey
ALTER TABLE [dbo].[administrations] ADD CONSTRAINT [administrations_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[departments] ADD CONSTRAINT [departments_administrationId_fkey] FOREIGN KEY ([administrationId]) REFERENCES [dbo].[administrations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
