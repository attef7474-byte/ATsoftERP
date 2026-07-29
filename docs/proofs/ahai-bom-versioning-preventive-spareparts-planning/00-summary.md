# AH-AI: BOM Versioning + Preventive Spare Parts Planning

## Summary
Implemented Bill of Materials (BOM) versioning and preventive spare parts planning for the maintenance CMMS module. This enables maintenance teams to define versioned BOMs for machines/components and generate spare parts plans from PM schedules with stock availability checks.

## Key Outcomes
- **Schema**: 5 new models (90 tables total, +5; 1,295 columns, +53)
- **Migration**: Additive SQL script — no destructive changes
- **Numbering**: 2 new entity types (MAINTENANCE_BOM → BOM-, PREVENTIVE_SPARE_PART_PLAN → PSP-) — 49 total sequences
- **Backend**: 2 modules, 33 endpoints (CRUD + versions + status machine + generate-from-schedule + copy-to-request)
- **Permissions**: 8 new (maintenance-bom:crud, preventive-spare-part-plan:crud)
- **i18n**: 13 API messages + ~40 UI keys + 2 settings keys — EN/AR matched
- **Audit**: All mutations logged
- **Integration**: `generateFromSchedule()` reads active BOMs and spare part links; `copyToRequest()` creates required parts on a maintenance request

## Validations
- API build: PASS ✅
- Web build: PASS ✅
- Prisma validate/generate: PASS ✅
- Seed: PASS (49 sequences, 474 permissions)
- API route registration: PASS (33/33 endpoints)

## Tags
- `atsoft-erp-ahai-bom-versioning-preventive-spareparts-planning`
- `atsoft-erp-current-release-final-audited-v3-bom-pm-spareparts`
- `atsoft-erp-ahai-bom-planning-proof`

## Proof Docs
| # | Document | Status |
|---|----------|--------|
| 00 | Summary | ✅ |
| 01 | Current BOM/PM Audit | ✅ |
| 01 | Scope and Rules | ✅ |
| 02 | Implementation Map | ✅ |
| 03 | API Proof | ✅ |
| 05 | DB Integrity Proof | ✅ |
| 06 | i18n Proof | ✅ |
| 07 | Permissions + Audit Proof | ✅ |
| 08 | Validation Report | ✅ |
| 09 | Final Acceptance Report | ✅ |
