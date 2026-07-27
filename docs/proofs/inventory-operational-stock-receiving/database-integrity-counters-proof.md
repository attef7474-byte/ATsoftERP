# Database Integrity Proof — Operational Stock Receiving

## Constraints
1. **PK**: `id` columns on both tables
2. **UNIQUE**: `code` on `inventory_operational_receipts`
3. **FK**: `companyId` → `companies`, `branchId` → `branches`, `warehouseId` → `warehouses`, `createdById` → `users`, `receiptId` → parent, `productId` → `products`
4. **DEFAULT**: status='DRAFT', documentDate=GETDATE(), createdAt/updatedAt=GETDATE()

## Indexes
| Table | Indexes |
|-------|---------|
| inventory_operational_receipts | IX_companyId, IX_branchId, IX_warehouseId, IX_status, IX_documentDate, IX_code, IX_createdAt |
| inventory_operational_receipt_lines | IX_receiptId, IX_productId |

## Transactional Integrity
- Document creation wrapped in `$transaction` — atomic number sequence increment + insert
- POST operation wrapped in `$transaction` — atomic movement + balance update + status change
- All foreign keys use `ON DELETE NO ACTION ON UPDATE NO ACTION`
