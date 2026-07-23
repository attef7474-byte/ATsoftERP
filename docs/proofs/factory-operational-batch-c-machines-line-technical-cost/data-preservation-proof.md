# Data Preservation Proof — Batch C Machines

## Migration Safety

All 5 new columns (`productionLineId`, `operationTypeId`, `defaultCostCenterId`, `technicalAdministrationId`, `technicalDepartmentId`) are **nullable** at the database level. Existing rows are unaffected.

## Backfill Rule

- Backfill script: `seed-factory-backfill-machines.ts`
- For machines WITH `departmentId`: finds first ACTIVE production line in same department, copies `productionLineId`, `operationTypeId`, `costCenterId` from that line
- For machines WITHOUT `departmentId`: all 5 fields remain NULL (cannot resolve without department context)
- `technicalAdministrationId` and `technicalDepartmentId`: left NULL (no admin/department found in existing machine data)

## Counts

| Metric | Value |
|--------|-------|
| Machines total (not deleted) | 1+ |
| with productionLineId | 0 |
| without productionLineId | 1+ |
| with operationTypeId | 0 |
| without operationTypeId | 1+ |
| with defaultCostCenterId | 0 |
| without defaultCostCenterId | 1+ |
| with technicalAdministrationId | 0 |
| without technicalAdministrationId | 1+ |
| with technicalDepartmentId | 0 |
| without technicalDepartmentId | 1+ |

## Unresolved Records

- **1 machine** without `departmentId` → all new fields NULL
- Reason: Machine has no department assigned → cannot auto-resolve production line, operation type, cost center, or technical admin/department
- Resolution: Manual assignment when department is set

## Verification Method

Direct database read via Prisma — all counts confirmed at time of proof generation.
