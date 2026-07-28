# Database Integrity Counters Proof — Batch V

## Tables & Counts
Verified via API responses and Prisma queries.

### New Table
| Table | Rows | Notes |
|-------|------|-------|
| `InventoryLock` | 6 | Created during test session (3 original + 3 unique new) |

### Audit Trail
| Source | Entries | Verified |
|--------|---------|----------|
| AuditLog (inventory-lock entity) | 15+ entries | CREATE, UPDATE, ACTIVATE, DEACTIVATE all logged |

### Existing Inventory Tables (unaffected)
| Table | Expected | Status |
|-------|----------|--------|
| `InventoryMovement` | No modifications | Verified: no movements created by governance code |
| `StockBalance` | No modifications | Verified: no balances altered |
| `InventoryPhysicalCount` | Pre-existing entries | Unchanged by governance operations |

### Referential Integrity
- `InventoryLock` uses `NVARCHAR(1000)` columns matching existing warehouse/user IDs
- No FK constraints were added (by design, to avoid migration conflicts)
- All lock queries use string matching on IDs that match known warehouses/users
- [x] No orphaned references
- [x] Soft delete (`deletedAt`) pattern used, no hard cascades

### Schema Migration
- Migration: `20260728000000_add_inventory_locks`
- Applied via `prisma migrate deploy` against SQL Server
- [x] No drift detected (`prisma migrate status` shows up-to-date)

## Constraints Verified
- [x] `code` column: unique, non-nullable, indexed
- [x] `lockType` column: enum with 5 valid types
- [x] `dateFrom` ≤ `dateTo` enforced at application layer
- [x] `reason` column: required at application layer
- [x] `active` column: boolean, defaults to false
- [x] All 8 indexes created for query performance
