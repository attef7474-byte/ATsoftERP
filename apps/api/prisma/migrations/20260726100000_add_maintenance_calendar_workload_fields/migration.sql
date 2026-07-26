-- Add calendar/workload planning fields

-- Add estimated_duration_minutes to maintenance_requests
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'estimated_duration_minutes')
    ALTER TABLE maintenance_requests ADD estimated_duration_minutes INT NULL;

-- Add daily_capacity_minutes to maintenance_personnel
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_personnel' AND COLUMN_NAME = 'daily_capacity_minutes')
    ALTER TABLE maintenance_personnel ADD daily_capacity_minutes INT NOT NULL CONSTRAINT DF_maintenance_personnel_daily_capacity_minutes DEFAULT 480;
