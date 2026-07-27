# Phase 3: Variance Control Design

## Variance Calculation
- varianceQty = countedQty - systemQty (backend-calculated, never trusted from frontend)
- Positive variance: actual count > system → COUNT_VARIANCE_IN movement (direction IN)
- Negative variance: actual count < system → COUNT_VARIANCE_OUT movement (direction OUT)
- Zero variance: no movement generated

## Movement Creation on POST
When a physical count is posted:
1. Collect all lines with non-zero variance
2. For each line with positive variance:
   - Create InventoryMovementLine with direction=IN, quantity=abs(varianceQty)
   - Associate with InventoryMovement of type=COUNT_VARIANCE_IN
3. For each line with negative variance:
   - Create InventoryMovementLine with direction=OUT, quantity=abs(varianceQty)
   - Associate with InventoryMovement of type=COUNT_VARIANCE_OUT
4. Update InventoryBalance:
   - Find existing balance record for (warehouseId, productId, locationId)
   - quantity = quantity + varianceQty (positive adds, negative subtracts)
   - If no balance record exists, create one (positive variance only)
5. Everything in a single $transaction

## Movement Type Constants
Add to movement types:
- COUNT_VARIANCE_IN: "Count Variance In" (فروقات جرد إضافة)
- COUNT_VARIANCE_OUT: "Count Variance Out" (فروقات جرد خصم)

## Source Tracking
- Movement.sourceType = "PHYSICAL_COUNT"
- Movement.sourceId = physicalCount.id
- This links back the movement to the originating count

## No Adjustment Documents
- Unlike existing InventoryCount which generates InventoryAdjustment docs,
  InventoryPhysicalCount posts directly to movements and StockBalance.
- This is the intended design: count variance goes through official inventory movements only.

## Business Rules
- Only APPROVED counts can be posted
- Once POSTED, cannot be modified or cancelled (create a new count instead)
- Rejected counts go back to DRAFT for re-counting
- Variance must be calculated and stored before posting
- POST endpoint validates all lines have countedQty entered
