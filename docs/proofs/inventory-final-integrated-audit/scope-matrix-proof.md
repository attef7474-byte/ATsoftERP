# Scope Matrix — Inventory Final Integrated Audit

## Inventory Modules O Through V

| Batch | Feature | Backend Module | API Endpoints | Frontend Pages | Movement Types | Source Documents | Permissions | Audit Coverage | Lock Coverage | Report Coverage | Traceability | Status | Risk | Decision |
|-------|---------|---------------|---------------|----------------|----------------|-----------------|-------------|---------------|--------------|----------------|-------------|--------|------|----------|
| O | Maintenance Issue | maintenance-stock | POST/GET issues | spare-parts/issue | MAINTENANCE_ISSUE | MaintenancePartLine | inventory:stock:issue | ✅ | ✅ | ✅ | ✅ | ACCEPTED | Low | Carry |
| O | Maintenance Return | maintenance-stock | POST/GET returns | spare-parts/return | MAINTENANCE_RETURN | MaintenancePartLine | inventory:stock:return | ✅ | ✅ | ✅ | ✅ | ACCEPTED | Low | Carry |
| P | Ledger | inventory-ledger | GET ledger | inventory/ledger | ALL | movement register | inventory:ledger:read | ✅ | N/A (read) | ✅ | ✅ | ACCEPTED | Low | Carry |
| P | Reconciliation | inventory-reconciliation | GET reconciliation | inventory/reconciliation | ALL | StockBalance | inventory:reconciliation:read | ✅ | N/A (read) | N/A | N/A | ACCEPTED | Low | Carry |
| Q | Opening Balance | inventory-opening-balances | POST/GET/PATCH | opening-balances | OPENING_BALANCE | OpeningBalance | inventory:opening-balance:* | ✅ | ❌ (not guarded) | ✅ | ✅ | ACCEPTED | Low | Carry |
| Q | Stock Adjustment | inventory-stock-adjustments | POST/GET/PATCH | stock-adjustments | STOCK_ADJUSTMENT_IN/OUT | StockAdjustment | inventory:stock-adjustment:* | ✅ | ✅ | ✅ | ✅ | ACCEPTED | Low | Carry |
| R | Transfer | inventory-stock-transfers | POST/GET/PATCH | transfers | STOCK_TRANSFER_OUT/IN | InventoryTransfer | inventory:transfer:* | ✅ | ✅ | ✅ | ✅ | ACCEPTED_WDL | Low | Carry |
| S | Operational Receiving | inventory-operational-receipts | POST/GET/PATCH | operational-receiving | STOCK_RECEIVING | OperationalReceipt | inventory:operational-receipt:* | ✅ | ✅ | ✅ | ✅ | ACCEPTED_WDL | Low | Carry |
| T | Physical Count | inventory-physical-counts | POST/GET/PATCH | physical-counts | COUNT_VARIANCE_IN/OUT | PhysicalCount | inventory:physical-count:* | ✅ | ✅ | ✅ | ✅ | ACCEPTED_WDL | Low | Carry |
| U | Reports | inventory-reports | GET reports | inventory/reports | ALL | StockBalance + Movement | inventory:reports:* | ✅ | N/A (read) | N/A | ✅ | ACCEPTED | Low | Carry |
| U | Traceability | inventory-reports | GET traceability | traceability | ALL | source docs | inventory:reports:* | ✅ | N/A (read) | N/A | ✅ | ACCEPTED | Low | Carry |
| V | Permissions | auth/permissions | PermissionsGuard | — | — | — | 13 governance perms | ✅ | N/A | N/A | N/A | ACCEPTED_WDL | Low | Carry |
| V | Audit | inventory-audit | GET audit | governance-audit | — | AuditLog | inventory:audit:* | N/A | N/A | N/A | N/A | ACCEPTED_WDL | Low | Carry |
| V | Locks | inventory-locks | 8 endpoints | inventory/locks | — | InventoryLock | inventory:lock:* | ✅ | N/A | N/A | N/A | ACCEPTED_WDL | Low | Carry |

## Legend
- ✅ = Covered
- ❌ = Not covered (documented limitation)
- N/A = Not applicable
- ACCEPTED_WDL = Accepted With Documented Limitation

## Documented Limitations Carried Forward
1. Batch R/S: migration workflow requires `migrate deploy` not `migrate dev` (shadow DB may be blocked)
2. Batch T: one prior browser DRAFT timing skip (non-user-facing)
3. Batch V: LOCATION_LOCK and ITEM_LOCK N/A by design
4. Batch V: Finance/HR/Sales/Purchasing tables not in schema (N/A)
5. Batch V: lock response is 403 Forbidden (blocks mutation), not 409 LOCKED
6. Batch Q: Opening Balance controller has no InventoryLockGuard (by design — opening balances are pre-operational)
