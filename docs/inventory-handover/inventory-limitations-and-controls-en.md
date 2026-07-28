# Inventory Limitations and Controls — English

## Implemented Controls
| Control | Implementation | Status |
|---------|---------------|--------|
| Lock: PERIOD_LOCK | Blocks posting within a date range | Implemented |
| Lock: WAREHOUSE_LOCK | Blocks posting for a warehouse | Implemented |
| Lock: GLOBAL_INVENTORY_LOCK | Blocks all inventory posting | Implemented |
| Lock: USER_LOCK | Blocks inventory posting for a user | Implemented |
| Lock: TRANSACTION_TYPE_LOCK | Blocks specific transaction types | Implemented |
| Document status workflow | Draft → Submitted → Approved → Posted | Implemented |
| Minimum reason length | 5 characters required | Implemented |
| Audit log | All state changes recorded | Implemented |
| Permission-based access | Per-operation authorization | Implemented |
| Insufficient stock check | Prevents OUT when balance too low | Implemented |
| Posted document immutability | No edit/delete after posting | Implemented |
| Transfer source ≠ destination | Prevents same-warehouse transfer | Implemented |

## Known Limitations
| Limitation | Impact | Workaround | Planned? |
|-----------|--------|-----------|----------|
| LOCATION_LOCK not implemented | Cannot lock by sub-location within warehouse | Use WAREHOUSE_LOCK instead | Not confirmed |
| ITEM_LOCK not implemented | Cannot lock individual items | Use TRANSACTION_TYPE_LOCK or manual process | Not confirmed |
| Lock override not implemented | No bypass mechanism | Deactivate lock before posting | Future consideration |
| Finance/Accounting not activated | No COGS, no GL entries | Inventory is standalone | Separate batch |
| HR module not activated | No employee→user sync | Manual user management | Separate batch |
| Sales not activated | No sales order→delivery link | Inventory out via adjustment | Separate batch |
| Purchasing not activated | No PO→receiving link | Inventory in via operational receipt | Separate batch |
| Opening Balance no pre-posting guard | Posting may succeed before governance review | Manual review before posting; check audit log | Could be added |
| Migration uses `prisma migrate deploy` | No `migrate dev` (shadow DB unavailable) | Must use `deploy` in CI/CD | Not needed |
| No stock valuation method (FIFO/LIFO/weighted) | Quantity only, no unit cost | Not implemented | Future enhancement |
| No inventory reorder / min-max alerts | No automated replenishment suggestions | Manual monitoring | Future enhancement |
| No batch/lot tracking | Items tracked by product only | Not implemented | Future enhancement |
| No serial number tracking | Items tracked by product only | Not implemented | Future enhancement |

## Recommended Controls (Not Yet Implemented)
- Pre-posting governance check for Opening Balance
- Lock override with justification audit trail
- Reorder level alerts
- Stock valuation and unit cost
