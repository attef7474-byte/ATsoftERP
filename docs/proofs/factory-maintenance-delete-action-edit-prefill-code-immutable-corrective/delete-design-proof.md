# Delete Design Proof

## Delete Action Design

Every maintenance page follows this pattern:

### Action Bar
- "Delete" button with `ActionDeleteIcon`
- `variant: 'danger'` for visual distinction
- `enabled: !!selectedId` - only enabled when a row is selected

### Confirmation
- `ConfirmDialog` with `variant: 'danger'` 
- Shows title: `t('common.confirmDeleteTitle')` 
- Shows message: `t('common.confirmDeleteMessage')`
- `loading={saving}` during API call
- Cancel reverts state, Confirm calls API

### API Integration
- All delete methods call `api.delete()` on the backend
- On success: toast notification, list refresh, selected row clear
- On error: toast with error message

### Backend Delete Strategies

| Strategy | Entities | Count |
|----------|----------|-------|
| Soft delete (deletedAt) | ProductionLines, OperationTypes, CostCenters, MachineCategories, MachineComponents, SpareParts, MaintenanceRequests | 7 |
| Hard delete (prisma.delete) | MachineParts, MaintenanceChecklistItems, MaintenanceTasks, DowntimeLogs | 4 |
| Status update (INACTIVE/CANCELLED) | MachineResponsibilityAssignments, MaintenanceSchedules, MaintenancePartAccountability | 3 |
| Deactivation (isActive: false) | MaintenancePersonnel | 1 |

### Dependency Checks
- ProductionLines: checks Machine, MaintenanceRequest
- OperationTypes: checks Machine, ProductionLine, MaintenanceRequest
- CostCenters: checks Machine, ProductionLine, MaintenanceRequest
- MachineCategories: checks Machine, child categories
- MachineComponents: checks child components, ComponentSparePart
- MachineParts: checks MaintenanceRequestPartUsage
- SpareParts: checks MachineSparePart, ComponentSparePart, MaintenanceRequestRequiredPart
- MaintenancePersonnel: checks machineResponsibilities, requestAssignments
- MaintenanceChecklistItems: checks MaintenanceChecklistExecutionItem (NEWLY ADDED)
