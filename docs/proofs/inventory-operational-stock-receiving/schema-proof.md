# Schema Proof — Operational Stock Receiving

## Migration Applied
File: `apps/api/prisma/migrations/20260727150000_add_operational_receipts/migration.sql`

## Tables Created

### inventory_operational_receipts
| Column | Type | Constraints |
|--------|------|-------------|
| id | NVARCHAR(1000) | PK |
| code | NVARCHAR(1000) | UNIQUE |
| companyId | NVARCHAR(1000) | FK → companies |
| branchId | NVARCHAR(1000) | FK → branches, NULL |
| warehouseId | NVARCHAR(1000) | FK → warehouses |
| locationId | NVARCHAR(1000) | NULL |
| status | NVARCHAR(1000) | DEFAULT 'DRAFT' |
| documentDate | DATETIME2 | DEFAULT GETDATE() |
| reason | NVARCHAR(MAX) | NOT NULL |
| notes | NVARCHAR(MAX) | NULL |
| supplierName | NVARCHAR(1000) | NULL |
| supplierDoc | NVARCHAR(1000) | NULL |
| submittedAt | DATETIME2 | NULL |
| submittedById | NVARCHAR(1000) | NULL |
| approvedAt | DATETIME2 | NULL |
| approvedById | NVARCHAR(1000) | NULL |
| rejectedAt | DATETIME2 | NULL |
| rejectedById | NVARCHAR(1000) | NULL |
| postedAt | DATETIME2 | NULL |
| postedById | NVARCHAR(1000) | NULL |
| cancelledAt | DATETIME2 | NULL |
| cancelledById | NVARCHAR(1000) | NULL |
| createdById | NVARCHAR(1000) | NOT NULL, FK → users |
| createdAt | DATETIME2 | DEFAULT GETDATE() |
| updatedAt | DATETIME2 | DEFAULT GETDATE() |
| deletedAt | DATETIME2 | NULL |

### inventory_operational_receipt_lines
| Column | Type | Constraints |
|--------|------|-------------|
| id | NVARCHAR(1000) | PK |
| receiptId | NVARCHAR(1000) | FK → inventory_operational_receipts |
| productId | NVARCHAR(1000) | FK → products |
| quantity | FLOAT | NOT NULL |
| notes | NVARCHAR(MAX) | NULL |
| createdAt | DATETIME2 | DEFAULT GETDATE() |
| updatedAt | DATETIME2 | DEFAULT GETDATE() |

## Prisma Models Added
- `InventoryOperationalReceipt` (model name)
- `InventoryOperationalReceiptLine` (model name)

## Indexes
7 indexes on receipts table, 2 indexes on lines table. All created.
