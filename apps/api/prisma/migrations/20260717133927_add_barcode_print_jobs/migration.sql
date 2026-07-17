BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[barcode_print_jobs] (
    [id] NVARCHAR(1000) NOT NULL,
    [labelId] NVARCHAR(1000),
    [templateId] NVARCHAR(1000),
    [entityType] NVARCHAR(1000),
    [entityId] NVARCHAR(1000),
    [printerName] NVARCHAR(1000),
    [copies] INT NOT NULL CONSTRAINT [barcode_print_jobs_copies_df] DEFAULT 1,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [barcode_print_jobs_status_df] DEFAULT 'PENDING',
    [printedById] NVARCHAR(1000),
    [jobType] NVARCHAR(1000) NOT NULL CONSTRAINT [barcode_print_jobs_jobType_df] DEFAULT 'LABEL',
    [note] NVARCHAR(500),
    [metadata] NVARCHAR(max),
    [requestedAt] DATETIME2 NOT NULL CONSTRAINT [barcode_print_jobs_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [barcode_print_jobs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [barcode_print_jobs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_print_jobs_labelId_idx] ON [dbo].[barcode_print_jobs]([labelId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_print_jobs_templateId_idx] ON [dbo].[barcode_print_jobs]([templateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_print_jobs_entityType_entityId_idx] ON [dbo].[barcode_print_jobs]([entityType], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_print_jobs_status_idx] ON [dbo].[barcode_print_jobs]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_print_jobs_printedById_idx] ON [dbo].[barcode_print_jobs]([printedById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_print_jobs_requestedAt_idx] ON [dbo].[barcode_print_jobs]([requestedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[barcode_print_jobs] ADD CONSTRAINT [barcode_print_jobs_labelId_fkey] FOREIGN KEY ([labelId]) REFERENCES [dbo].[barcode_labels]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
