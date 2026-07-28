# Spare Part Classification Proof — Batch Y

## Classification Fields Added to SparePart Model

| Field | Values | Description |
|-------|--------|-------------|
| technicalClassification | MECHANICAL, ELECTRICAL, ELECTRONIC, HYDRAULIC, PNEUMATIC, LUBRICANT, CHEMICAL, SAFETY, GENERAL | Technical domain of the spare part |
| usageType | CONSUMABLE, REPLACEABLE, REPAIRABLE, ROTABLE | How the part is used/replaced |
| nature | ORIGINAL, GENERIC, REFURBISHED, LOCAL | Origin/source of the part |
| importance | CRITICAL, HIGH, MEDIUM, LOW | Criticality for operations |

## Backend Implementation

- DTO: `CreateSparePartDto` and `UpdateSparePartDto` include all 4 fields as `@IsOptional() @IsString()`
- Controller: 4 new filter query params accepted in `findAll()`
- Service: Filter conditions added to `where` clause (exact match)
- All values validated at application level; string type used because SQL Server does not support Prisma enums
- Classification values are read from SparePart catalog during issue (auto-derived, not trusted from frontend)

## Frontend Implementation

- List page: 4 new columns in grid; 4 Select dropdowns in create/edit modal
- Detail page: Classification badge row
- Edit page: 4 Select dropdowns with all valid values
- All dropdowns include empty option (field is nullable)

## Auto-Derivation During Issue

When spare part is selected during stock issue:
- `technicalClassification`, `usageType`, `nature`, `importance` are read from the SparePart catalog
- Frontend-sent classification values are IGNORED (not trusted)
- Values are displayed as read-only badges
