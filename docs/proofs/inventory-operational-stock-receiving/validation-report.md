# Validation Report — Operational Stock Receiving

## Backend Validations
1. **Company check**: Must exist
2. **Warehouse check**: Must exist
3. **Location check**: If provided, must belong to selected warehouse
4. **Branch check**: If provided, must exist
5. **Product check**: Each line product must exist
6. **Quantity check**: Must be > 0
7. **Number sequence**: OPERATIONAL_RECEIPT must be configured
8. **Workflow guards**: Invalid transitions return 400
9. **DRAFT-only modification**: Lines can only be added/edited/removed in DRAFT
10. **POST uniqueness**: Creates exactly one INVENTORY_MOVEMENT per POST

## Frontend Validations
1. Required fields: Company, Warehouse, Reason
2. At least one line required before save
3. Quantity must be positive
4. Action buttons enabled only for valid status transitions
5. Confirm dialogs for all workflow actions
