-- Batch A: Organization + People Foundation
-- Creates: job_titles, operational_person_assignments, supervisor_assignments
-- Extends: departments (classification field)
-- Relations: Company, Branch, Administration, Department, OperationalPerson

-- 1. Create job_titles table
CREATE TABLE [dbo].[job_titles] (
    [id]          NVARCHAR(1000)  NOT NULL,
    [companyId]   NVARCHAR(1000)  NOT NULL,
    [code]        NVARCHAR(100)   NOT NULL,
    [name]        NVARCHAR(255)   NOT NULL,
    [nameAr]      NVARCHAR(255)   NULL,
    [nameEn]      NVARCHAR(255)   NULL,
    [category]    NVARCHAR(50)    NOT NULL DEFAULT 'OPERATIONAL',
    [description] NVARCHAR(MAX)   NULL,
    [isActive]    BIT             NOT NULL DEFAULT 1,
    [status]      NVARCHAR(50)    NOT NULL DEFAULT 'ACTIVE',
    [createdAt]   DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    [updatedAt]   DATETIME2       NOT NULL,
    [deletedAt]   DATETIME2       NULL,
    CONSTRAINT [job_titles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [job_titles_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [job_titles_companyId_code_key] UNIQUE NONCLUSTERED ([companyId], [code])
);
CREATE INDEX [job_titles_companyId_idx] ON [dbo].[job_titles] ([companyId]);
CREATE INDEX [job_titles_status_idx] ON [dbo].[job_titles] ([status]);

-- 2. Create operational_person_assignments table
CREATE TABLE [dbo].[operational_person_assignments] (
    [id]               NVARCHAR(1000)  NOT NULL,
    [companyId]        NVARCHAR(1000)  NOT NULL,
    [branchId]         NVARCHAR(1000)  NULL,
    [administrationId] NVARCHAR(1000)  NULL,
    [departmentId]     NVARCHAR(1000)  NOT NULL,
    [jobTitleId]       NVARCHAR(1000)  NULL,
    [personnelId]      NVARCHAR(1000)  NOT NULL,
    [assignmentType]   NVARCHAR(50)    NOT NULL DEFAULT 'PRIMARY',
    [effectiveFrom]    DATETIME2       NOT NULL,
    [effectiveTo]      DATETIME2       NULL,
    [status]           NVARCHAR(50)    NOT NULL DEFAULT 'ACTIVE',
    [notes]            NVARCHAR(MAX)   NULL,
    [createdByUserId]  NVARCHAR(1000)  NULL,
    [createdAt]        DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    [updatedAt]        DATETIME2       NOT NULL,
    [deletedAt]        DATETIME2       NULL,
    CONSTRAINT [operational_person_assignments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [operational_person_assignments_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [operational_person_assignments_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [operational_person_assignments_administrationId_fkey] FOREIGN KEY ([administrationId]) REFERENCES [dbo].[administrations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [operational_person_assignments_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [operational_person_assignments_jobTitleId_fkey] FOREIGN KEY ([jobTitleId]) REFERENCES [dbo].[job_titles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [operational_person_assignments_personnelId_fkey] FOREIGN KEY ([personnelId]) REFERENCES [dbo].[operational_people]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [operational_person_assignments_personnelId_departmentId_effectiveFrom_key] UNIQUE NONCLUSTERED ([personnelId], [departmentId], [effectiveFrom])
);
CREATE INDEX [operational_person_assignments_companyId_idx] ON [dbo].[operational_person_assignments] ([companyId]);
CREATE INDEX [operational_person_assignments_branchId_idx] ON [dbo].[operational_person_assignments] ([branchId]);
CREATE INDEX [operational_person_assignments_departmentId_idx] ON [dbo].[operational_person_assignments] ([departmentId]);
CREATE INDEX [operational_person_assignments_personnelId_idx] ON [dbo].[operational_person_assignments] ([personnelId]);
CREATE INDEX [operational_person_assignments_status_idx] ON [dbo].[operational_person_assignments] ([status]);

-- 3. Create supervisor_assignments table
CREATE TABLE [dbo].[supervisor_assignments] (
    [id]                     NVARCHAR(1000)  NOT NULL,
    [companyId]              NVARCHAR(1000)  NOT NULL,
    [assignmentId]           NVARCHAR(1000)  NOT NULL,
    [supervisorAssignmentId] NVARCHAR(1000)  NULL,
    [relationshipType]       NVARCHAR(50)    NOT NULL DEFAULT 'DIRECT',
    [effectiveFrom]          DATETIME2       NOT NULL,
    [effectiveTo]            DATETIME2       NULL,
    [isActive]               BIT             NOT NULL DEFAULT 1,
    [status]                 NVARCHAR(50)    NOT NULL DEFAULT 'ACTIVE',
    [createdAt]              DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    [updatedAt]              DATETIME2       NOT NULL,
    [deletedAt]              DATETIME2       NULL,
    CONSTRAINT [supervisor_assignments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [supervisor_assignments_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [supervisor_assignments_assignmentId_fkey] FOREIGN KEY ([assignmentId]) REFERENCES [dbo].[operational_person_assignments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [supervisor_assignments_supervisorAssignmentId_fkey] FOREIGN KEY ([supervisorAssignmentId]) REFERENCES [dbo].[operational_person_assignments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX [supervisor_assignments_companyId_idx] ON [dbo].[supervisor_assignments] ([companyId]);
CREATE INDEX [supervisor_assignments_assignmentId_idx] ON [dbo].[supervisor_assignments] ([assignmentId]);
CREATE INDEX [supervisor_assignments_supervisorAssignmentId_idx] ON [dbo].[supervisor_assignments] ([supervisorAssignmentId]);
CREATE INDEX [supervisor_assignments_status_idx] ON [dbo].[supervisor_assignments] ([status]);

-- 4. Add classification column to departments (nullable, default 'OPERATIONAL')
ALTER TABLE [dbo].[departments] ADD [classification] NVARCHAR(50) NULL DEFAULT 'OPERATIONAL';
