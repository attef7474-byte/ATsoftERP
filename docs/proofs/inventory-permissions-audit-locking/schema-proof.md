# Schema Proof — Batch V

## Migration
- Migration folder: `apps/api/prisma/migrations/20260728000000_add_inventory_locks/`
- Migration SQL applied to SQL Server (WINCC:50079)
- Uses `prisma migrate deploy` (not `migrate dev`)

## Table: inventory_locks
Created on SQL Server with columns:
- id NVARCHAR(1000) PK
- code NVARCHAR(1000) NOT NULL
- lockType NVARCHAR(1000) NOT NULL
- status NVARCHAR(1000) NOT NULL DEFAULT 'ACTIVE'
- dateFrom DATETIME2 NOT NULL
- dateTo DATETIME2 NOT NULL
- warehouseId NVARCHAR(1000) NULL
- locationId NVARCHAR(1000) NULL
- productId NVARCHAR(1000) NULL
- sparePartId NVARCHAR(1000) NULL
- reason NVARCHAR(MAX) NOT NULL
- notes NVARCHAR(MAX) NULL
- createdByUserId NVARCHAR(1000) NULL
- createdAt DATETIME2 NOT NULL DEFAULT GETDATE()
- updatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
- activatedByUserId NVARCHAR(1000) NULL
- activatedAt DATETIME2 NULL
- deactivatedByUserId NVARCHAR(1000) NULL
- deactivatedAt DATETIME2 NULL

## Indexes
- IX_inventory_locks_lockType on lockType
- IX_inventory_locks_status on status
- IX_inventory_locks_dateRange on (dateFrom, dateTo)
- IX_inventory_locks_warehouseId on warehouseId
- IX_inventory_locks_locationId on locationId
- IX_inventory_locks_productId on productId
- IX_inventory_locks_sparePartId on sparePartId
- IX_inventory_locks_status_lockType on (status, lockType)

## Prisma validation
- `prisma validate` — PASS
- `prisma generate` — PASS
- `prisma migrate status` — Database schema is up to date
