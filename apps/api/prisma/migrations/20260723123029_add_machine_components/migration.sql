BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[machine_components] (
    [id] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000) NOT NULL,
    [parentComponentId] NVARCHAR(1000),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [componentType] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [locationInMachine] NVARCHAR(1000),
    [manufacturer] NVARCHAR(1000),
    [model] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [criticality] NVARCHAR(1000) NOT NULL CONSTRAINT [machine_components_criticality_df] DEFAULT 'MEDIUM',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [machine_components_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [machine_components_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [machine_components_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [machine_components_machineId_code_key] UNIQUE NONCLUSTERED ([machineId],[code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_components_machineId_idx] ON [dbo].[machine_components]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_components_parentComponentId_idx] ON [dbo].[machine_components]([parentComponentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_components_componentType_idx] ON [dbo].[machine_components]([componentType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_components_criticality_idx] ON [dbo].[machine_components]([criticality]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_components_status_idx] ON [dbo].[machine_components]([status]);

-- AddForeignKey
ALTER TABLE [dbo].[machine_components] ADD CONSTRAINT [machine_components_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_components] ADD CONSTRAINT [machine_components_parentComponentId_fkey] FOREIGN KEY ([parentComponentId]) REFERENCES [dbo].[machine_components]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
