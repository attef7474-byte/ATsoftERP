# API Proof — Stock Transfers (Batch R)

## Endpoints Tested (15)

| # | Method | Endpoint | Status | Notes |
|---|--------|----------|--------|-------|
| 1 | POST | `/inventory/stock-transfers` | ✅ 201 | Create transfer with lines |
| 2 | GET | `/inventory/stock-transfers` | ✅ 200 | Paginated list with filters |
| 3 | GET | `/inventory/stock-transfers/:id` | ✅ 200 | Single record with includes |
| 4 | PATCH | `/inventory/stock-transfers/:id` | ✅ 200 | Update DRAFT transfer |
| 5 | DELETE | `/inventory/stock-transfers/:id` | ✅ 200 | Soft delete DRAFT only |
| 6 | POST | `/inventory/stock-transfers/:id/submit` | ✅ 200 | DRAFT → SUBMITTED |
| 7 | POST | `/inventory/stock-transfers/:id/approve` | ✅ 200 | SUBMITTED → APPROVED |
| 8 | POST | `/inventory/stock-transfers/:id/reject` | ✅ 200 | SUBMITTED → REJECTED |
| 9 | POST | `/inventory/stock-transfers/:id/post` | ✅ 200 | APPROVED → POSTED (creates paired movements) |
| 10 | POST | `/inventory/stock-transfers/:id/cancel` | ✅ 200 | DRAFT/SUBMITTED → CANCELLED |

### Line Management
| 11 | POST | `/inventory/stock-transfers/:id/lines` | ✅ 201 | Add line to DRAFT |
| 12 | PATCH | `/inventory/stock-transfers/:id/lines/:lineId` | ✅ 200 | Update line |
| 13 | DELETE | `/inventory/stock-transfers/:id/lines/:lineId` | ✅ 200 | Remove line from DRAFT |

### Validation Endpoints
| 14 | GET | `/inventory/stock-transfers/:id/validate` | ✅ 200 | Checks source≠destination, stock availability |
| 15 | GET | `/inventory/stock-transfers/available/:productId/:warehouseId` | ✅ 200 | Available stock query |

## Workflow Validation

- DRAFT → submit → SUBMITTED ✅
- SUBMITTED → approve → APPROVED ✅
- SUBMITTED → reject → REJECTED ✅
- APPROVED → post → POSTED ✅
- POSTED → cancel → ❌ Blocked (immutable) ✅
- DRAFT → delete → ✅ (soft delete)
- DRAFT → post → ❌ Blocked (must approve first) ✅
- POSTED → edit → ❌ Blocked (immutable) ✅

## Business Rules

- Source warehouse ≠ destination warehouse ✅ (409 on same warehouse)
- Quantity > 0 ✅ (400 on zero/negative)
- Insufficient stock → 409 ✅
- Missing company/source/destination/reason → 400 ✅
- At least one line required → 400 ✅

## Conclusion

All 15 endpoints verified. Workflow transitions validated end-to-end. Business rule enforcement confirmed.
