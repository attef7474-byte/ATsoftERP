# Inventory Troubleshooting Guide — English

| Error / Issue | Meaning | Likely Cause | User Action | Admin Action | Escalate? |
|---------------|---------|-------------|-------------|-------------|-----------|
| 401 Unauthorized | Not logged in | Session expired or no token | Log in again | — | No |
| 403 Forbidden | No permission or lock active | Missing permission OR active lock blocks operation | Check role permissions; if lock active, wait or request deactivation | Verify permission assignment; deactivate lock if safe | Yes if permission missing and user should have it |
| "Operation blocked by active inventory lock" | A PERIOD_LOCK, WAREHOUSE_LOCK, or GLOBAL_INVENTORY_LOCK is active | Lock period covers the operation date | Wait until lock ends, or request deactivation | Deactivate lock if appropriate | Yes if lock should not apply |
| "Invalid status transition" | Document status change not allowed | Trying to approve already-posted document or cancel without required status | Check current document status before action | — | No |
| "reason must be a string" / "reason too short" | Reason field missing or < 5 chars | User did not enter enough text | Enter minimum 5 character reason | — | No |
| "Insufficient stock" | Stock balance too low for OUT movement | Not enough quantity in warehouse | Check stock card for available quantity | — | No |
| Report shows no data | Report is empty | No matching records or wrong filter | Adjust filters (date range, product, warehouse) | — | No |
| Traceability source missing | Source document not found | Source deleted or never linked | Check if source document exists | Investigate data integrity | Yes |
| Reconciliation difference > 0 | StockBalance != expected from movements | Manual edit, missing movement, or data issue | Investigate via ledger and source docs | Create adjustment if legitimate difference | Yes if cause unclear |
| "Cannot edit after posting" | Posted document immutable by design | Document already posted | Posted documents cannot be edited or deleted | Create corrective document (adjustment) | No |
| "Cannot delete after posting" | Posted document immutable by design | Document already posted | Use cancellation workflow if available | — | No |
| Physical count zero variance | Counted = system quantity | Accurate count or no changes since freeze | No action needed; post without variance movement | — | No |
| Transfer source = destination | Same warehouse selected | User error | Select different warehouses | — | No |
| "This page could not be found" | Route does not exist | Finance/Purchasing/Sales/HR pages intentionally not activated | Only inventory and maintenance routes are active | — | No |
| Operational receiving created no PO | Expected behavior | This is by design | Operational receiving does NOT create PO or supplier invoice | — | No |
| migrate dev fails | Shadow DB not available | SQL Server permissions or Docker unavailable | Use `prisma migrate deploy` instead | Follow project migration workflow | Yes |
