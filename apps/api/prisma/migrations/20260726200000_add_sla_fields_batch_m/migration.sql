-- Batch M: Add SLA fields to maintenance_requests
-- Applied manually via prisma db execute on 2026-07-26, then registered as official migration.

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'responseDueAt')
    ALTER TABLE maintenance_requests ADD responseDueAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'startDueAt')
    ALTER TABLE maintenance_requests ADD startDueAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'completeDueAt')
    ALTER TABLE maintenance_requests ADD completeDueAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'slaStatus')
    ALTER TABLE maintenance_requests ADD slaStatus NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'escalationLevel')
    ALTER TABLE maintenance_requests ADD escalationLevel NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'lastEscalatedAt')
    ALTER TABLE maintenance_requests ADD lastEscalatedAt DATETIME2 NULL;
