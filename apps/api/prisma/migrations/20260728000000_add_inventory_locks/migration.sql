CREATE TABLE inventory_locks (
    id NVARCHAR(1000) NOT NULL,
    code NVARCHAR(1000) NOT NULL,
    lockType NVARCHAR(1000) NOT NULL,
    status NVARCHAR(1000) NOT NULL DEFAULT 'ACTIVE',
    dateFrom DATETIME2 NOT NULL,
    dateTo DATETIME2 NOT NULL,
    warehouseId NVARCHAR(1000),
    locationId NVARCHAR(1000),
    productId NVARCHAR(1000),
    sparePartId NVARCHAR(1000),
    reason NVARCHAR(MAX) NOT NULL,
    notes NVARCHAR(MAX),
    createdByUserId NVARCHAR(1000),
    createdAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    updatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    activatedByUserId NVARCHAR(1000),
    activatedAt DATETIME2,
    deactivatedByUserId NVARCHAR(1000),
    deactivatedAt DATETIME2,

    CONSTRAINT PK_inventory_locks PRIMARY KEY (id)
);

CREATE INDEX IX_inventory_locks_lockType ON inventory_locks(lockType);
CREATE INDEX IX_inventory_locks_status ON inventory_locks(status);
CREATE INDEX IX_inventory_locks_dateRange ON inventory_locks(dateFrom, dateTo);
CREATE INDEX IX_inventory_locks_warehouseId ON inventory_locks(warehouseId);
CREATE INDEX IX_inventory_locks_locationId ON inventory_locks(locationId);
CREATE INDEX IX_inventory_locks_productId ON inventory_locks(productId);
CREATE INDEX IX_inventory_locks_sparePartId ON inventory_locks(sparePartId);
CREATE INDEX IX_inventory_locks_status_lockType ON inventory_locks(status, lockType);
