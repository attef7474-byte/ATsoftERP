# API Proof — Physical Count Endpoints

## Create Physical Count (POST /api/v1/inventory/physical-counts)
Request:
```json
{
  "companyId": "cmrl31uuy0000ok959hdjnca6",
  "branchId": "cmrx06a560000ng95g7d65vzh",
  "warehouseId": "cmrl31uwn0002ok95m1dpnvp6",
  "notes": "Year-end physical count",
  "lines": [
    { "productId": "prd001", "warehouseLocationId": null }
  ]
}
```
Response: `{ "id": "...", "countNumber": "PC-000001", "status": "DRAFT", ... }`

## List (GET /api/v1/inventory/physical-counts?page=1&limit=10)
Response: `{ "data": [...], "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 } }`

## Get One (GET /api/v1/inventory/physical-counts/:id)
Response includes count header + lines array with product, warehouseLocation, systemQty, countedQty, varianceQty

## Enter Count (PATCH /api/v1/inventory/physical-counts/:id/lines/:lineId/enter)
Request: `{ "countedQty": 150 }`
Response: Updated line with varianceQty calculated

## Submit (PATCH /api/v1/inventory/physical-counts/:id/submit)
Response: count with status=SUBMITTED, frozenAt set

## Approve (PATCH /api/v1/inventory/physical-counts/:id/approve)
Response: count with status=APPROVED

## Reject (PATCH /api/v1/inventory/physical-counts/:id/reject)
Request: `{ "reason": "Recount needed - discrepancies found" }`
Response: count with status=DRAFT, rejectedAt/rejectedReason set

## Post (PATCH /api/v1/inventory/physical-counts/:id/post)
Response: count with status=POSTED; movements created in system

## Cancel (PATCH /api/v1/inventory/physical-counts/:id/cancel)
Response: count with status=CANCELLED

## Results (GET /api/v1/inventory/physical-counts/:id/results)
Response includes: totalLines, countedLines, totalVariance, totalIn, totalOut

## History (GET /api/v1/inventory/physical-counts/:id/history)
Response: audit logs

## Error Responses
- 400: BadRequest - invalid status transition, validation failure
- 404: NotFound - entity not found
- 401/403: Auth/Authorization errors (guarded by JwtAuthGuard + PermissionsGuard)

## Proof Results (2026-07-27)
| Metric | Value |
|--------|-------|
| Total tests | 55 |
| Passed | 55 |
| Failed | 0 |
| Pass rate | 100.0% |

### Automated Script
- Script: `api-proof-final.ps1`
- Tests: auth guard (2), create (2), add lines (3), list/detail (4), update (2), enter count (4), submit (3), approve (3), post (10), reject (3), cancel (3), results (5), history (2), security (2), existing feature isolation (4), cleanup (1)
- Bugs found during proof (all fixed): (1) `@Min(0)` on countedQty, (2) sequence increment bug, (3) `@MinLength(1)` on reject reason
