# Backend Proof — Stock Transfers (Batch R)

## Module Structure

```
apps/api/src/modules/factory/inventory-stock-transfers/
├── dto/
│   ├── create-inventory-stock-transfer.dto.ts   — Create DTO with lines
│   ├── update-inventory-stock-transfer.dto.ts   — Update DTO (partial)
│   └── query-inventory-stock-transfer.dto.ts    — Filter/pagination DTO
├── inventory-stock-transfers.controller.ts      — 15 endpoints
├── inventory-stock-transfers.module.ts          — Module registration
├── inventory-stock-transfers.service.ts         — Business logic
└── inventory-stock-transfers.service.spec.ts    — (future)
```

## Service Layer (InventoryStockTransfersService)

### Methods

| Method | Purpose |
|--------|---------|
| `create(dto)` | Create transfer with lines, generate STOCK_TRANSFER code |
| `findAll(query)` | Paginated list with filters (company, branch, srcWh, dstWh, status) |
| `findOne(id)` | Single record with all relations |
| `update(id, dto)` | Update DRAFT transfer |
| `remove(id)` | Soft delete DRAFT only |
| `submit(id)` | DRAFT → SUBMITTED, sets submittedAt/submittedById |
| `approve(id)` | SUBMITTED → APPROVED, sets approvedAt/approvedById |
| `reject(id)` | SUBMITTED → REJECTED, sets rejectedAt/rejectedById |
| `post(id)` | APPROVED → POSTED, creates paired OUT+IN movements, updates balances |
| `cancel(id)` | DRAFT/SUBMITTED → CANCELLED |
| `addLine(id, dto)` | Add line to DRAFT transfer |
| `updateLine(id, lineId, dto)` | Update line |
| `removeLine(id, lineId)` | Remove line from DRAFT transfer |

### Posting Logic (post method)

1. Validates status is APPROVED
2. For each line:
   - Checks sufficient stock at source warehouse/location
   - Creates STOCK_TRANSFER_OUT movement (decreases source balance)
   - Creates STOCK_TRANSFER_IN movement (increases destination balance)
   - Links movement IDs to line
3. All operations in a Prisma transaction (rollback on failure)
4. Sets postedAt/postedById

## Key Business Rules

- Source warehouse must differ from destination warehouse
- Quantity must be positive
- Only DRAFT can be edited/deleted
- Only APPROVED can be posted
- Posted transfers are immutable
- Stock check before posting: 409 if insufficient

## Dependencies

| Dependency | Purpose |
|------------|---------|
| PrismaService | Database access |
| NumberingService | Generate STOCK_TRANSFER code |
| InventoryMovementsService | Create paired movements |
| InventoryBalancesService | Update source/destination balances |

## Module Registration

- `InventoryStockTransfersModule` registered in `apps/api/src/app.module.ts`
- Seed file updated: STOCK_TRANSFER number sequence
- Permissions added: 9 `inventory:stock-transfer:*` entries

## Conclusion

Full CRUD + workflow service with transactional posting, paired movement creation, and balance updates. Backend code compiles cleanly (build:api passes).
