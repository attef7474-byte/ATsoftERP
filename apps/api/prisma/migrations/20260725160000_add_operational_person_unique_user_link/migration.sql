-- CreateTable: operational_people
CREATE TABLE [dbo].[operational_people] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_people_category_df] DEFAULT N'MAINTENANCE',
    [userId] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [operational_people_isActive_df] DEFAULT 1,
    [phone] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [operational_people_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [operational_people_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [operational_people_code_key] UNIQUE NONCLUSTERED ([code])
);

-- Backfill operational_people from maintenance_personnel
INSERT INTO [dbo].[operational_people] ([id], [code], [name], [category], [userId], [isActive], [phone], [email], [notes], [createdAt], [updatedAt])
SELECT [id], [code], [name], N'MAINTENANCE', [userId], [isActive], [phone], [email], [notes], [createdAt], [updatedAt]
FROM [dbo].[maintenance_personnel];

-- Create indexes for operational_people
CREATE NONCLUSTERED INDEX [operational_people_code_idx] ON [dbo].[operational_people]([code]);
CREATE NONCLUSTERED INDEX [operational_people_category_idx] ON [dbo].[operational_people]([category]);
CREATE NONCLUSTERED INDEX [operational_people_userId_idx] ON [dbo].[operational_people]([userId]);
CREATE NONCLUSTERED INDEX [operational_people_isActive_idx] ON [dbo].[operational_people]([isActive]);

-- Add filtered unique index: only one non-null userId per OperationalPerson
CREATE UNIQUE NONCLUSTERED INDEX [UX_operational_people_userId_not_null] ON [dbo].[operational_people]([userId]) WHERE [userId] IS NOT NULL;

-- AlterTable: Add operationalPersonId to maintenance_personnel
ALTER TABLE [dbo].[maintenance_personnel] ADD [operationalPersonId] NVARCHAR(1000);

-- Backfill operationalPersonId with same IDs (operational_people was copied with same PKs)
UPDATE [dbo].[maintenance_personnel] SET [operationalPersonId] = [id];

-- Make operationalPersonId required
ALTER TABLE [dbo].[maintenance_personnel] ALTER COLUMN [operationalPersonId] NVARCHAR(1000) NOT NULL;

-- Add unique constraint on operationalPersonId
ALTER TABLE [dbo].[maintenance_personnel] ADD CONSTRAINT [maintenance_personnel_operationalPersonId_key] UNIQUE NONCLUSTERED ([operationalPersonId]);

-- Add foreign key for operationalPersonId
ALTER TABLE [dbo].[maintenance_personnel] ADD CONSTRAINT [maintenance_personnel_operationalPersonId_fkey] FOREIGN KEY ([operationalPersonId]) REFERENCES [dbo].[operational_people]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Drop unique constraint and indexes before dropping columns
ALTER TABLE [dbo].[maintenance_personnel] DROP CONSTRAINT [maintenance_personnel_code_key];
DROP INDEX [maintenance_personnel_code_idx] ON [dbo].[maintenance_personnel];
DROP INDEX [maintenance_personnel_userId_idx] ON [dbo].[maintenance_personnel];
ALTER TABLE [dbo].[maintenance_personnel] DROP CONSTRAINT [maintenance_personnel_userId_fkey];

-- Drop old columns from maintenance_personnel
ALTER TABLE [dbo].[maintenance_personnel] DROP COLUMN [code];
ALTER TABLE [dbo].[maintenance_personnel] DROP COLUMN [name];
ALTER TABLE [dbo].[maintenance_personnel] DROP COLUMN [phone];
ALTER TABLE [dbo].[maintenance_personnel] DROP COLUMN [email];
ALTER TABLE [dbo].[maintenance_personnel] DROP COLUMN [notes];
ALTER TABLE [dbo].[maintenance_personnel] DROP COLUMN [userId];
