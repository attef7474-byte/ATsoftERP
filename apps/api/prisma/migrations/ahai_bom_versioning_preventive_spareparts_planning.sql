-- Batch AH-AI: BOM Versioning + Preventive Spare Parts Planning
-- Migration script for SQL Server 2016 Express
-- Additive only — no destructive changes
-- Pre: 85 tables, 1242 columns
-- Post: 90 tables, ~1296 columns

-- ── 1. MaintenanceBom ──────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'maintenance_boms')
BEGIN
    CREATE TABLE maintenance_boms (
        id           NVARCHAR(1000) NOT NULL PRIMARY KEY,
        code         NVARCHAR(255) NOT NULL,
        name         NVARCHAR(255) NOT NULL,
        description  NVARCHAR(MAX) NULL,
        machineId    NVARCHAR(1000) NULL,
        componentId  NVARCHAR(1000) NULL,
        status       NVARCHAR(50)   NOT NULL DEFAULT 'ACTIVE',
        createdAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
        deletedAt    DATETIME2     NULL,

        CONSTRAINT UQ_maintenance_boms_code UNIQUE (code),
        CONSTRAINT FK_maintenance_boms_machine FOREIGN KEY (machineId) REFERENCES machines(id) ON DELETE NO ACTION,
        CONSTRAINT FK_maintenance_boms_component FOREIGN KEY (componentId) REFERENCES machine_components(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_maintenance_boms_machineId ON maintenance_boms(machineId);
    CREATE INDEX IX_maintenance_boms_componentId ON maintenance_boms(componentId);
    CREATE INDEX IX_maintenance_boms_status ON maintenance_boms(status);
    CREATE INDEX IX_maintenance_boms_code ON maintenance_boms(code);
END;

-- ── 2. MaintenanceBomVersion ───────────────────────────────────
IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'maintenance_bom_versions')
BEGIN
    CREATE TABLE maintenance_bom_versions (
        id             NVARCHAR(1000) NOT NULL PRIMARY KEY,
        bomId          NVARCHAR(1000) NOT NULL,
        versionNumber  INT            NOT NULL,
        versionLabel   NVARCHAR(255)  NOT NULL,
        description    NVARCHAR(MAX)  NULL,
        isActive       BIT            NOT NULL DEFAULT 0,
        effectiveDate  DATETIME2      NULL,
        createdById    NVARCHAR(1000) NULL,
        createdAt      DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt      DATETIME2     NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_bom_versions_bom FOREIGN KEY (bomId) REFERENCES maintenance_boms(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_bom_versions_bom_version UNIQUE (bomId, versionNumber),
        CONSTRAINT FK_bom_versions_createdBy FOREIGN KEY (createdById) REFERENCES users(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_bom_versions_bomId ON maintenance_bom_versions(bomId);
    CREATE INDEX IX_bom_versions_isActive ON maintenance_bom_versions(isActive);
    CREATE INDEX IX_bom_versions_bomId_isActive ON maintenance_bom_versions(bomId, isActive);
END;

-- ── 3. MaintenanceBomItem ──────────────────────────────────────
IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'maintenance_bom_items')
BEGIN
    CREATE TABLE maintenance_bom_items (
        id            NVARCHAR(1000) NOT NULL PRIMARY KEY,
        bomVersionId  NVARCHAR(1000) NOT NULL,
        sparePartId   NVARCHAR(1000) NOT NULL,
        quantity      FLOAT         NOT NULL,
        unit          NVARCHAR(50)  NULL,
        usageNote     NVARCHAR(MAX) NULL,
        isCritical    BIT           NOT NULL DEFAULT 0,
        sortOrder     INT           NOT NULL DEFAULT 0,
        createdAt     DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt     DATETIME2     NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_bom_items_version FOREIGN KEY (bomVersionId) REFERENCES maintenance_bom_versions(id) ON DELETE NO ACTION,
        CONSTRAINT FK_bom_items_sparePart FOREIGN KEY (sparePartId) REFERENCES spare_parts(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_bom_items_bomVersionId ON maintenance_bom_items(bomVersionId);
    CREATE INDEX IX_bom_items_sparePartId ON maintenance_bom_items(sparePartId);
END;

-- ── 4. PreventiveSparePartPlan ─────────────────────────────────
IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'preventive_spare_part_plans')
BEGIN
    CREATE TABLE preventive_spare_part_plans (
        id            NVARCHAR(1000) NOT NULL PRIMARY KEY,
        planNumber    NVARCHAR(255)  NOT NULL,
        scheduleId    NVARCHAR(1000) NOT NULL,
        machineId     NVARCHAR(1000) NOT NULL,
        title         NVARCHAR(255)  NOT NULL,
        description   NVARCHAR(MAX)  NULL,
        status        NVARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
        generatedById NVARCHAR(1000) NULL,
        generatedAt   DATETIME2     NOT NULL DEFAULT GETDATE(),
        createdAt     DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt     DATETIME2     NOT NULL DEFAULT GETDATE(),

        CONSTRAINT UQ_spare_part_plans_planNumber UNIQUE (planNumber),
        CONSTRAINT FK_spare_part_plans_schedule FOREIGN KEY (scheduleId) REFERENCES maintenance_schedules(id) ON DELETE NO ACTION,
        CONSTRAINT FK_spare_part_plans_machine FOREIGN KEY (machineId) REFERENCES machines(id) ON DELETE NO ACTION,
        CONSTRAINT FK_spare_part_plans_generatedBy FOREIGN KEY (generatedById) REFERENCES users(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_spare_part_plans_scheduleId ON preventive_spare_part_plans(scheduleId);
    CREATE INDEX IX_spare_part_plans_machineId ON preventive_spare_part_plans(machineId);
    CREATE INDEX IX_spare_part_plans_status ON preventive_spare_part_plans(status);
    CREATE INDEX IX_spare_part_plans_planNumber ON preventive_spare_part_plans(planNumber);
END;

-- ── 5. PreventiveSparePartPlanItem ─────────────────────────────
IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'preventive_spare_part_plan_items')
BEGIN
    CREATE TABLE preventive_spare_part_plan_items (
        id                NVARCHAR(1000) NOT NULL PRIMARY KEY,
        planId            NVARCHAR(1000) NOT NULL,
        sparePartId       NVARCHAR(1000) NOT NULL,
        plannedQuantity   FLOAT          NOT NULL,
        availableQuantity FLOAT          NULL,
        condition         NVARCHAR(50)   NULL,
        unit              NVARCHAR(50)   NULL,
        isAvailable       BIT            NOT NULL DEFAULT 0,
        copyToRequestId   NVARCHAR(1000) NULL,
        notes             NVARCHAR(MAX) NULL,
        createdAt         DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt         DATETIME2     NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_plan_items_plan FOREIGN KEY (planId) REFERENCES preventive_spare_part_plans(id) ON DELETE NO ACTION,
        CONSTRAINT FK_plan_items_sparePart FOREIGN KEY (sparePartId) REFERENCES spare_parts(id) ON DELETE NO ACTION,
        CONSTRAINT FK_plan_items_copyToRequest FOREIGN KEY (copyToRequestId) REFERENCES maintenance_requests(id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_plan_items_planId ON preventive_spare_part_plan_items(planId);
    CREATE INDEX IX_plan_items_sparePartId ON preventive_spare_part_plan_items(sparePartId);
    CREATE INDEX IX_plan_items_copyToRequestId ON preventive_spare_part_plan_items(copyToRequestId);
END;

PRINT 'Migration completed: 5 tables created (maintenance_boms, maintenance_bom_versions, maintenance_bom_items, preventive_spare_part_plans, preventive_spare_part_plan_items)';
