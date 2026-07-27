# Console/Network Proof — API Test Verification

## API Test Commands

### Create Physical Count
```bash
curl -X POST http://localhost:4000/api/v1/inventory/physical-counts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "cmrl31uuy0000ok959hdjnca6",
    "warehouseId": "cmrl31uwn0002ok95m1dpnvp6",
    "notes": "Test count",
    "lines": [{"productId": "<product-id>"}]
  }'
```
Expected: 201, countNumber = PC-000001, status = DRAFT

### List Physical Counts
```bash
curl http://localhost:4000/api/v1/inventory/physical-counts \
  -H "Authorization: Bearer <token>"
```
Expected: 200, paginated list

### Get Count Detail
```bash
curl http://localhost:4000/api/v1/inventory/physical-counts/<id> \
  -H "Authorization: Bearer <token>"
```
Expected: 200, count with lines

### Enter Count Quantity
```bash
curl -X PATCH http://localhost:4000/api/v1/inventory/physical-counts/<id>/lines/<lineId>/enter \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"countedQty": 150}'
```
Expected: 200, varianceQty = 150 - systemQty

### Submit
```bash
curl -X PATCH http://localhost:4000/api/v1/inventory/physical-counts/<id>/submit \
  -H "Authorization: Bearer <token>"
```
Expected: 200, status = SUBMITTED

### Approve
```bash
curl -X PATCH http://localhost:4000/api/v1/inventory/physical-counts/<id>/approve \
  -H "Authorization: Bearer <token>"
```
Expected: 200, status = APPROVED

### Post (creates movements)
```bash
curl -X PATCH http://localhost:4000/api/v1/inventory/physical-counts/<id>/post \
  -H "Authorization: Bearer <token>"
```
Expected: 200, status = POSTED, movements created

### Verify Movement Created
```bash
curl http://localhost:4000/api/v1/inventory/movements?sourceType=PHYSICAL_COUNT&sourceId=<id> \
  -H "Authorization: Bearer <token>"
```
Expected: 200, movement with type COUNT_VARIANCE_IN or COUNT_VARIANCE_OUT

## Negative Tests

### Post without all lines counted
Expected: 400 BadRequest — "All lines must have counted quantity before posting"

### Submit with no lines
Expected: 400 BadRequest — "Cannot submit a physical count with no lines"

### Update POSTED count
Expected: 400 BadRequest — "Only DRAFT physical counts can be updated"

### Delete POSTED count
Expected: 400 BadRequest — "Only DRAFT physical counts can be deleted"
