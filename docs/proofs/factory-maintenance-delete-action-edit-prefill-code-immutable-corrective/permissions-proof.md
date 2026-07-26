# Permissions Proof

## Permission Naming Convention

All delete endpoints follow the pattern: `<entity>:delete`

### Delete Permissions Used

| Entity | Permission Key | Guard |
|--------|---------------|-------|
| ProductionLines | `productionLines:delete` | JwtAuthGuard + PermissionsGuard |
| OperationTypes | `operationTypes:delete` | JwtAuthGuard + PermissionsGuard |
| CostCenters | `costCenters:delete` | JwtAuthGuard + PermissionsGuard |
| MachineCategories | `machine-category:delete` (was `:deactivate`, FIXED) | JwtAuthGuard + PermissionsGuard |
| MachineComponents | `machine-component:delete` | JwtAuthGuard + PermissionsGuard |
| MachineParts | `machine-part:delete` (was `:deactivate`, FIXED) | JwtAuthGuard + PermissionsGuard |
| SpareParts | `spare-part:delete` | JwtAuthGuard + PermissionsGuard |
| Machines | `machines:delete` | JwtAuthGuard + PermissionsGuard |
| Personnel | `maintenance-personnel:delete` | JwtAuthGuard + PermissionsGuard |
| MachineResponsibilities | `machine-responsibility:delete` | JwtAuthGuard + PermissionsGuard |
| ChecklistItems | `maintenance-checklist:delete` | JwtAuthGuard + PermissionsGuard |
| Schedules | `maintenance-schedule:delete` | JwtAuthGuard + PermissionsGuard |
| Tasks | `maintenance-task:delete` | JwtAuthGuard + PermissionsGuard |
| DowntimeLogs | `downtime-log:delete` | JwtAuthGuard + PermissionsGuard |
| Requests | `maintenance-request:delete` | JwtAuthGuard + PermissionsGuard |
| PartAccountability | `maintenance-part-accountability:delete` | JwtAuthGuard + PermissionsGuard |

### SUPER_ADMIN Role
- All permissions automatically assigned to SUPER_ADMIN via seed
- PermissionsGuard grants SUPER_ADMIN unconditional access

### Security Behavior
- No token → 401 Unauthorized (JwtAuthGuard)
- Bad token → 401 Unauthorized (JwtAuthGuard)
- Missing permission → 403 Forbidden (PermissionsGuard)
- HR module: INACTIVE (not modified)
- Finance module: INACTIVE (not modified)
- BI module: INACTIVE (not modified)
