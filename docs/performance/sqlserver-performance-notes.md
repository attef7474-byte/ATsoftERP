# SQL Server Performance Notes — ATsoftERP

## Server Details

| Property | Value |
|---|---|
| Instance | `localhost,50079` |
| Database | `ATsoftERP_DB` |
| App User | `atsofterp_app` |
| ORM | Prisma 7 + SQL Server provider |

## Index Strategy

### Batch 25 — Performance Indexing (July 2026)

Added ~80 new indexes across 34 tables targeting:

#### 1. Foreign Key Lookups
- `UserRole`: `userId`, `roleId` (separate indexes beyond composite PK)
- `RolePermission`: `roleId`, `permissionId`
- `Department`: `branchId`
- `Warehouse`: `branchId`
- All child -> parent FK columns

#### 2. Status + Date Filters (common query patterns)
- `User`: `status + createdAt`
- `Product`: `status + createdAt`, `categoryId + status`
- `MaintenanceRequest`: `status + priority`, `machineId + status`, `assignedToId + status`, `status + createdAt`
- `MaintenanceTask`: `requestId + status`, `assignedToId + status`
- `DowntimeLog`: `machineId + startTime`, `requestId + cancelledAt`, `endTime + cancelledAt`
- `InventoryCount`: `warehouseId + status`, `status + createdAt`
- `InventoryMovement`: `warehouseId + status`, `status + movementDate`
- `InventoryAdjustment`: `warehouseId + status`, `status + adjustmentDate`
- All `barcode_*` tables: `status + createdAt`, `entityType + entityId + status`

#### 3. Search / Sort Columns
- `User`: `email`, `name`
- `Product`: `code`, `name`, `createdAt`
- `Machine`: `code`, `createdAt`
- `MachinePart`: `code`, `name`
- All `inventory_*` tables: `countNumber`, `movementNumber`, `adjustmentNumber`, `createdAt`
- `AuditLog`: `entity + entityId`, `userId + action`, `entity + createdAt`
- `Notification`: `userId + read`, `userId + createdAt`

#### 4. Reporting Aggregations
- `InventoryBalance`: `quantity`, `updatedAt`, `warehouseId + productId`
- `InventoryCountLine`: `countId + status`, `countId + productId`
- `InventoryMovementLine`: `movementId + productId`
- `InventoryAdjustmentLine`: `adjustmentId + productId`

## N+1 Query Fixes

### Fixed in `maintenance-requests.service.ts` (`findAll`)
**Before**: 1 query for requests + 3N queries (N = page size) for per-request task/downtime stats.
**After**: 1 query for requests + 3 batched `groupBy` queries total (independent of page size).

### Fixed in `maintenance.service.ts` (`getOperationalSummary`)
**Before**: 1 query for machines + 5N queries (N = total machines) via per-machine `getMachineSummary`.
**After**: 1 query for machines + 5 batched queries total.

### Fixed in `maintenance.service.ts` (`getMachineSummary`)
Optimized from sequential individual queries to parallel `Promise.all` (5 -> 1 round trip).

## Best Practices

### Schema
- Every FK column has an index (either standalone or composite).
- Every model has index on `status` and `createdAt` for filtering and sorting.
- Composite indexes follow column selectivity order (most selective first).
- Avoid over-indexing: no more than 5-8 non-clustered indexes per table.

### Queries
- All list endpoints use pagination (`skip/take`) with a max page size of 100.
- All aggregation endpoints use Prisma `groupBy` or `aggregate` instead of loading full rows.
- Use `select` instead of `include: true` to limit fetched columns.
- Use `_count` in `include` for simple counts instead of separate queries.

### Monitoring Queries
```sql
-- Missing index suggestions
SELECT * FROM sys.dm_db_missing_index_details WHERE database_id = DB_ID();

-- Most expensive queries (past 24h via Query Store)
SELECT TOP 10 qsq.query_id, qsq.total_worker_time/1000000 AS total_cpu_sec,
  qsq.total_logical_reads, qsq.total_elapsed_time/1000000 AS total_elapsed_sec,
  SUBSTRING(qt.query_sql_text, 1, 200) AS query_text
FROM sys.query_store_query qsq
JOIN sys.query_store_query_text qt ON qsq.query_text_id = qt.query_text_id
ORDER BY qsq.total_worker_time DESC;

-- Index fragmentation
SELECT OBJECT_NAME(i.object_id) AS table_name, i.name AS index_name,
  ips.avg_fragmentation_in_percent, ips.page_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 30
ORDER BY ips.avg_fragmentation_in_percent DESC;

-- Index usage stats
SELECT OBJECT_NAME(s.object_id) AS table_name, i.name AS index_name,
  s.user_seeks, s.user_scans, s.user_lookups, s.user_updates,
  s.last_user_seek, s.last_user_scan
FROM sys.dm_db_index_usage_stats s
JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
WHERE s.database_id = DB_ID() AND OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1
ORDER BY (s.user_seeks + s.user_scans + s.user_lookups) DESC;
```

### Maintenance
- Rebuild indexes with >30% fragmentation weekly.
- Update statistics daily (or auto-update threshold: 20% of rows changed).
- Archive old data from `audit_logs`, `barcode_scan_events`, `downtime_logs` quarterly.
