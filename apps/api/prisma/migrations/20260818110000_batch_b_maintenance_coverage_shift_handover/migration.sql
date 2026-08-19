-- Batch B: Maintenance Coverage + Shift Handover
-- Extends: machine_responsibility_assignments (scopeType, departmentId, productionLineId, nullable machineId)
-- Creates: shift_handovers, shift_handover_items

-- 1. Extend machine_responsibility_assignments: add scopeType with default MACHINE
ALTER TABLE [dbo].[machine_responsibility_assignments] ADD [scopeType] NVARCHAR(1000) NOT NULL CONSTRAINT [machine_responsibility_assignments_scopeType_df] DEFAULT 'MACHINE';

-- 2. Extend machine_responsibility_assignments: add departmentId (nullable)
ALTER TABLE [dbo].[machine_responsibility_assignments] ADD [departmentId] NVARCHAR(1000) NULL;

-- 3. Extend machine_responsibility_assignments: add productionLineId (nullable)
ALTER TABLE [dbo].[machine_responsibility_assignments] ADD [productionLineId] NVARCHAR(1000) NULL;

-- 4. Make machineId nullable (existing rows retain their machineId value)
ALTER TABLE [dbo].[machine_responsibility_assignments] ALTER COLUMN [machineId] NVARCHAR(1000) NULL;

-- 5. Add foreign key constraints for new nullable columns
ALTER TABLE [dbo].[machine_responsibility_assignments] ADD CONSTRAINT [machine_responsibility_assignments_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[machine_responsibility_assignments] ADD CONSTRAINT [machine_responsibility_assignments_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 6. Add indexes for new columns
CREATE NONCLUSTERED INDEX [machine_responsibility_assignments_scopeType_idx] ON [dbo].[machine_responsibility_assignments]([scopeType]);
CREATE NONCLUSTERED INDEX [machine_responsibility_assignments_departmentId_idx] ON [dbo].[machine_responsibility_assignments]([departmentId]);
CREATE NONCLUSTERED INDEX [machine_responsibility_assignments_productionLineId_idx] ON [dbo].[machine_responsibility_assignments]([productionLineId]);

-- 7. Create shift_handovers table
CREATE TABLE [dbo].[shift_handovers] (
    [id]                      NVARCHAR(1000)  NOT NULL,
    [companyId]               NVARCHAR(1000)  NOT NULL,
    [branchId]                NVARCHAR(1000)  NULL,
    [departmentId]            NVARCHAR(1000)  NULL,
    [handoverDate]            DATETIME2       NOT NULL,
    [outgoingShiftId]         NVARCHAR(1000)  NOT NULL,
    [incomingShiftId]         NVARCHAR(1000)  NOT NULL,
    [outgoingPersonId]        NVARCHAR(1000)  NULL,
    [incomingPersonId]        NVARCHAR(1000)  NULL,
    [activeProductionOrders]  INT             NULL,
    [openMaintenanceRequests] INT             NULL,
    [stoppedMachines]         INT             NULL,
    [pendingMaintenance]      INT             NULL,
    [notes]                   NVARCHAR(MAX)   NULL,
    [status]                  NVARCHAR(1000)  NOT NULL CONSTRAINT [shift_handovers_status_df] DEFAULT 'DRAFT',
    [submittedAt]             DATETIME2       NULL,
    [acknowledgedAt]          DATETIME2       NULL,
    [createdByUserId]         NVARCHAR(1000)  NULL,
    [createdAt]               DATETIME2       NOT NULL CONSTRAINT [shift_handovers_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt]               DATETIME2       NOT NULL,
    [deletedAt]               DATETIME2       NULL,
    CONSTRAINT [shift_handovers_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [shift_handovers_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [shift_handovers_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [shift_handovers_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [shift_handovers_outgoingShiftId_fkey] FOREIGN KEY ([outgoingShiftId]) REFERENCES [dbo].[production_shifts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [shift_handovers_incomingShiftId_fkey] FOREIGN KEY ([incomingShiftId]) REFERENCES [dbo].[production_shifts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [shift_handovers_outgoingPersonId_fkey] FOREIGN KEY ([outgoingPersonId]) REFERENCES [dbo].[operational_people]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [shift_handovers_incomingPersonId_fkey] FOREIGN KEY ([incomingPersonId]) REFERENCES [dbo].[operational_people]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE NONCLUSTERED INDEX [shift_handovers_companyId_idx] ON [dbo].[shift_handovers]([companyId]);
CREATE NONCLUSTERED INDEX [shift_handovers_branchId_idx] ON [dbo].[shift_handovers]([branchId]);
CREATE NONCLUSTERED INDEX [shift_handovers_departmentId_idx] ON [dbo].[shift_handovers]([departmentId]);
CREATE NONCLUSTERED INDEX [shift_handovers_handoverDate_idx] ON [dbo].[shift_handovers]([handoverDate]);
CREATE NONCLUSTERED INDEX [shift_handovers_outgoingShiftId_idx] ON [dbo].[shift_handovers]([outgoingShiftId]);
CREATE NONCLUSTERED INDEX [shift_handovers_incomingShiftId_idx] ON [dbo].[shift_handovers]([incomingShiftId]);
CREATE NONCLUSTERED INDEX [shift_handovers_status_idx] ON [dbo].[shift_handovers]([status]);

-- 8. Create shift_handover_items table
CREATE TABLE [dbo].[shift_handover_items] (
    [id]              NVARCHAR(1000)  NOT NULL,
    [companyId]       NVARCHAR(1000)  NOT NULL,
    [shiftHandoverId] NVARCHAR(1000)  NOT NULL,
    [category]        NVARCHAR(1000)  NOT NULL,
    [entityType]      NVARCHAR(1000)  NOT NULL,
    [entityId]        NVARCHAR(1000)  NOT NULL,
    [entityCode]      NVARCHAR(1000)  NULL,
    [entitySummary]   NVARCHAR(MAX)   NULL,
    [priority]        NVARCHAR(1000)  NULL,
    [status]          NVARCHAR(1000)  NULL,
    [notes]           NVARCHAR(MAX)   NULL,
    [createdAt]       DATETIME2       NOT NULL CONSTRAINT [shift_handover_items_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt]       DATETIME2       NOT NULL,
    [deletedAt]       DATETIME2       NULL,
    CONSTRAINT [shift_handover_items_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [shift_handover_items_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [shift_handover_items_shiftHandoverId_fkey] FOREIGN KEY ([shiftHandoverId]) REFERENCES [dbo].[shift_handovers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE NONCLUSTERED INDEX [shift_handover_items_companyId_idx] ON [dbo].[shift_handover_items]([companyId]);
CREATE NONCLUSTERED INDEX [shift_handover_items_shiftHandoverId_idx] ON [dbo].[shift_handover_items]([shiftHandoverId]);
CREATE NONCLUSTERED INDEX [shift_handover_items_category_idx] ON [dbo].[shift_handover_items]([category]);
CREATE NONCLUSTERED INDEX [shift_handover_items_entityType_entityId_idx] ON [dbo].[shift_handover_items]([entityType], [entityId]);
