# Auto Code Generation Coverage

| Entity | Has Code Field | Sequence Type | Uses NumberingService | Backend Generates | Unique Constraint | Status |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Company | Yes | COMPANY | Yes | Yes | @unique | FIXED |
| Branch | Yes | BRANCH | Yes | Yes | @@unique([companyId,code]) | FIXED |
| Department | Yes | DEPARTMENT | Yes | Yes | @@unique([companyId,code]) | FIXED |
| Warehouse | Yes | WAREHOUSE | Yes | Yes | @@unique([companyId,code]) | FIXED |
| Warehouse Location | Yes | WAREHOUSE_LOCATION | Yes | Yes | @@unique([warehouseId,code]) | FIXED |
| Product | Yes | PRODUCT | Yes | Yes | @unique | FIXED |
| Machine | Yes | MACHINE | Yes | Yes | @unique | FIXED |
| Machine Part | Yes | MACHINE_PART | Yes | Yes | (none) | FIXED |
| Maintenance Request | Yes (requestNumber) | MAINTENANCE_REQUEST | Manual | Yes | @unique | EXISTING |
| Inventory Count | Yes (countNumber) | INVENTORY_COUNT | Manual | Yes | @unique | EXISTING |
| Inventory Movement | Yes (movementNumber) | INVENTORY_MOVEMENT | Manual | Yes | @unique | EXISTING |
| Barcode Label | Yes | BARCODE_LABEL | Manual | Yes | @unique | EXISTING |
| Maintenance Task | No | — | — | — | — | N/A |
| Downtime | No | — | — | — | — | N/A |
| Machine Document | No | — | — | — | — | N/A |
