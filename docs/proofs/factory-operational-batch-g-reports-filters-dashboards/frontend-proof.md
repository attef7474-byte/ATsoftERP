# Frontend Proof — Batch G

## Pages Updated

| Page | Path | Filters Added |
|------|------|--------------|
| Overview | `apps/web/src/app/admin/reports/maintenance/page.tsx` | productionLine, machine, machineComponent, operationType, costCenter |
| Requests | `apps/web/src/app/admin/reports/maintenance/requests/page.tsx` | productionLine, machine, machineComponent, operationType, costCenter, sparePart (plus existing status/type/priority/date) |
| Downtime | `apps/web/src/app/admin/reports/maintenance/downtime/page.tsx` | productionLine, machine, operationType, costCenter (plus existing date) |
| Costs | `apps/web/src/app/admin/reports/maintenance/costs/page.tsx` | productionLine, machine, machineComponent, operationType, costCenter, sparePart (plus existing date) |
| Schedules | `apps/web/src/app/admin/reports/maintenance/schedules/page.tsx` | productionLine, machine, operationType, costCenter (plus existing dueStatus) |

## F9 Adapters Used
- `productionLineAdapter` — `/maintenance/production-lines`
- `machineAdapter` — `/maintenance/machines`
- `machineComponentAdapter` — `/maintenance/machine-components`
- `operationTypeAdapter` — `/maintenance/operation-types`
- `costCenterAdapter` — `/maintenance/cost-centers`
- `sparePartAdapter` — `/maintenance/spare-parts`

## Clear Filters
Each page includes a "Clear Filters" button that resets all operational filters to empty.

## Build
- build:web: PASS
