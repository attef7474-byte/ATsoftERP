# Cost Attribution Proof — Batch Y

## Fields on MaintenanceRequestRequiredPart

| Field | Source | Notes |
|-------|--------|-------|
| costOwnerType | User-provided or frontend | Optional |
| costOwnerAdministrationId | User-provided or frontend | Optional |
| costDepartmentId | Auto-derived from Machine.departmentId | Overrideable by user |
| costProductionLineId | Auto-derived from Machine.productionLineId | Overrideable by user |
| costMachineId | Auto-derived from Machine.id | Overrideable by user |
| costMachineComponentId | Auto-derived from part line machineComponentId | Overrideable by user |
| unitCost | User-provided | Optional |
| totalCost | Computed: unitCost × issuedQuantity | Set when unitCost provided |
| receivedByUserId | User-provided | Optional |
| receivedAt | Auto-set when receivedByUserId provided | new Date() |

## Auto-Derivation Rules

1. If `costDepartmentId` is NOT provided → derived from `Machine.departmentId`
2. If `costProductionLineId` is NOT provided → derived from `Machine.productionLineId`
3. If `costMachineId` is NOT provided → derived from `Machine.id`
4. If `costMachineComponentId` is NOT provided → derived from part line's `machineComponentId`
5. If user provides any cost field → user value takes precedence over derived
6. Classification fields are ALWAYS read from SparePart catalog (never overridden by frontend)

## No Finance Activation

- Cost fields are informational / intended attribution only
- No GL entries created
- No Journal Vouchers created
- No cost center allocations performed
- No financial period checks
- No accounting impact
