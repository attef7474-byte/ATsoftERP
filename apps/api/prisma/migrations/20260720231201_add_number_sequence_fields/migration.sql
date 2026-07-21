/*
  Warnings:

  - Added the required column `domain` to the `number_sequences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modelName` to the `number_sequences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operationName` to the `number_sequences` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[number_sequences] ADD [domain] NVARCHAR(1000) NOT NULL CONSTRAINT [number_sequences_domain_df] DEFAULT N'system',
[increment] INT NOT NULL CONSTRAINT [number_sequences_increment_df] DEFAULT 1,
[lastGeneratedCode] NVARCHAR(1000),
[modelName] NVARCHAR(1000) NOT NULL CONSTRAINT [number_sequences_modelName_df] DEFAULT N'',
[operationName] NVARCHAR(1000) NOT NULL CONSTRAINT [number_sequences_operationName_df] DEFAULT N'';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

