# Admin types split map

## Compatibility contract

- The existing import path remains unchanged: `@/lib/admin-types` and all current relative imports resolve through `apps/web/src/lib/admin-types.ts`.
- The compatibility file re-exports the directory barrel through the explicit path `./admin-types/index` to avoid file-versus-directory self-resolution.
- Domain files do not import from the barrel or from each other. Existing inline relation shapes remain inline, so the type graph has no circular imports.
- This phase moves type declarations only. It does not change API code, runtime behavior, type names, or consumer imports.

## Old type to new file mapping

| New file | Exported types |
| --- | --- |
| `admin-types/common.ts` | `PaginationMeta`, `PaginatedResponse<T>` |
| `admin-types/core.ts` | `Company`, `Branch`, `Department` |
| `admin-types/access.ts` | `User`, `UserRole`, `Role`, `RolePermission`, `Permission` |
| `admin-types/inventory.ts` | `Warehouse`, `WarehouseLocation`, `ProductCategory`, `Product`, `InventoryCountStatus`, `InventoryCountLineStatus`, `InventoryAdjustmentStatus`, `InventoryCount`, `InventoryCountLine`, `InventoryAdjustment`, `InventoryAdjustmentLine`, `InventoryBalance` |
| `admin-types/inventory-movement.ts` | `InventoryMovementStatus`, `InventoryMovementType`, `InventoryMovementDirection`, `InventoryMovement`, `InventoryMovementLine` |
| `admin-types/maintenance.ts` | `MachineCategory`, `Machine`, `MachinePart`, `MachineDocument`, `MaintenanceRequest`, `MaintenanceTask`, `MaintenanceSchedule`, `MaintenanceChecklistItem`, `MaintenanceRequestPartUsage`, `MaintenanceRequestCostEntry`, `MaintenanceChecklistExecution`, `MaintenanceChecklistExecutionItem`, `MachineMaintenanceLog`, `DowntimeLog` |
| `admin-types/barcodes.ts` | `BarcodeLabel`, `BarcodeScanEvent`, `BarcodeScanResponse`, `BarcodeLabelTemplate`, `BarcodePrintJob` |
| `admin-types/system.ts` | `AuditLog`, `Notification` |
| `admin-types/settings.ts` | `SystemSetting`, `NumberSequence` |
| `admin-types/reports.ts` | `MachineOperationalSummary`, `OperationalSummaryResponse`, `RequestSummary`, `DowntimeSummary`, `ScheduleSummary`, `BalanceSummary`, `CountSummary`, `MovementSummary`, `AdjustmentSummary` |

## Barrel layout

`admin-types/index.ts` re-exports the ten domain files. The original `admin-types.ts` contains only:

```ts
export * from './admin-types/index';
```

All 59 previous public exports remain represented once in the new domain files. Validation is intentionally deferred until all seven refactor phases are complete.
