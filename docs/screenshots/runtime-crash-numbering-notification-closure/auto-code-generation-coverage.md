# Auto Code Generation Coverage

| Entity | Code Field | Sequence Type | Uses NumberingService | Unique Constraint | Result |
|--------|:---:|:---:|:---:|:---:|:---:|
| Company | Yes | COMPANY | Yes | @unique | PASS |
| Branch | Yes | BRANCH | Yes | @@unique([companyId,code]) | PASS |
| Department | Yes | DEPARTMENT | Yes | @@unique([companyId,code]) | PASS |
| Warehouse | Yes | WAREHOUSE | Yes | @@unique([companyId,code]) | PASS |
| Warehouse Location | Yes | WAREHOUSE_LOCATION | Yes | @@unique([warehouseId,code]) | PASS |
| Product | Yes | PRODUCT | Yes | @unique | PASS |
| Machine | Yes | MACHINE | Yes | @unique | PASS |
| Machine Part | Yes | MACHINE_PART | Yes | (none) | PASS |
| Maintenance Request | Yes (requestNumber) | MAINTENANCE_REQUEST | Manual (existing) | @unique | PASS |
| Inventory Count | Yes (countNumber) | INVENTORY_COUNT | Manual (existing) | @unique | PASS |
| Inventory Movement | Yes (movementNumber) | INVENTORY_MOVEMENT | Manual (existing) | @unique | PASS |
| Barcode Label | Yes | BARCODE_LABEL | Manual (existing) | @unique | PASS |
