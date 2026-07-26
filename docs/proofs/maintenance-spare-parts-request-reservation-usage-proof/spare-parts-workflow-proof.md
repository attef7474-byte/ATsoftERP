# Spare Parts Workflow Proof — Maintenance Spare Parts Request + Reservation + Usage Proof

## Workflow Steps

```
DRAFT → REQUESTED → APPROVED → RESERVED → USED
                        ↓           ↓
                     REJECTED    CANCELLED
                        ↓
                     CANCELLED
```

### Step 1: DRAFT
- Line is created via POST /maintenance/requests/:requestId/parts
- Fields: sparePartId, quantity, reason (optional), unit, usageNote
- Status defaults to "DRAFT"
- Quantity and sparePart are required
- Duplicate spare part on same request is blocked unless previous line is CANCELLED/REJECTED/USED

### Step 2: REQUESTED
- PATCH :lineId/request
- Sets requestedByUserId, requestedAt, requestedQuantity (= quantity)
- Only allowed from DRAFT status

### Step 3: APPROVED
- PATCH :lineId/approve
- Sets approvedByUserId, approvedAt, approvedQuantity (= requestedQuantity or quantity)
- Only allowed from REQUESTED status

### Step 4: REJECTED
- PATCH :lineId/reject
- Sets rejectedByUserId, rejectedAt
- Only allowed from REQUESTED status
- Terminal status

### Step 5: RESERVED
- PATCH :lineId/reserve
- Sets reservedByUserId, reservedAt, reservedQuantity (= approvedQuantity or requestedQuantity or quantity)
- Only allowed from APPROVED status

### Step 6: USED
- PATCH :lineId/use
- Sets usedByUserId, usedAt, usedQuantity (= reservedQuantity or approvedQuantity or requestedQuantity or quantity)
- Allowed from RESERVED or APPROVED status (can skip reserve)
- Terminal status

### Step 7: CANCELLED
- PATCH :lineId/cancel
- Sets cancelledByUserId, cancelledAt
- Allowed from any non-terminal status (DRAFT, REQUESTED, APPROVED, RESERVED)
- Terminal status

## Key Behaviors
- No inventory movement created
- No stock balance changed
- No warehouse issue created
- No finance entry created
- All transitions validated against status machine
- Invalid transitions return 400
- Not found returns 404
- Unauthorized returns 401
