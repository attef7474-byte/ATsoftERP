# Machine Unit / Component Spare Part Proof — Batch Y

## Component SparePart Link

The existing `ComponentSparePart` model links `MachineComponent` to `SparePart`:
- Preferred link type for spare parts
- Allows filtering spare parts by selected component
- Supports quantity, unit, usageNote, isPrimary

## Machine SparePart Link (Legacy)

The existing `MachineSparePart` model links `Machine` directly to `SparePart`:
- Legacy/optional link type
- Not promoted as primary
- Used when component-level linking is not applicable

## Hierarchy

- `Department` → `ProductionLine` (via departmentId on ProductionLine)
- `ProductionLine` → `Machine` (via productionLineId on Machine)
- `Machine` → `MachineComponent` (via machineId on MachineComponent)
- `MachineComponent` → parent `MachineComponent` (via parentComponentId, self-referencing)
- `MachineComponent` → `SparePart` (via ComponentSparePart)

## Auto-Derivation During Issue

1. Selecting a maintenance request derives the linked machine
2. Selecting a machine derives:
   - `productionLineId` (from Machine.productionLineId)
   - `departmentId` (from Machine.departmentId)
   - `costMachineId` (from Machine.id)
   - `costProductionLineId` (from Machine.productionLineId)
   - `costDepartmentId` (from Machine.departmentId)
3. Selecting a machine component derives:
   - `machineId` (from MachineComponent.machineId)
   - Parent component hierarchy (via parentComponentId)
   - Component path: Machine → Unit/Component → Subcomponent
4. Components are validated to belong to the selected machine
