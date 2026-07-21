# Auto Code Generation Root Cause

## Problem
Creating records for Company, Branch, Department, and other entities
did not generate codes automatically. Users had to manually enter codes.

## Root Cause
The centralized NumberingService existed but was never injected or called
by any entity create service. Each service either:
1. Required user-supplied code via DTO (Company, Branch, Department,
   Warehouse, Product, Machine) — no auto-generation.
2. Reimplemented numbering logic manually by querying
   prisma.numberSequence directly (MaintenanceRequest, InventoryCount,
   BarcodeLabel, InventoryMovement) — bypassing NumberingService.

## Fix
- Made NumberingModule @Global() for easy injection everywhere.
- Made generateNumberAtomic transaction-safe.
- Injected NumberingService into every create service with a code field.
- Made code optional in DTOs; if absent, backend generates it.
