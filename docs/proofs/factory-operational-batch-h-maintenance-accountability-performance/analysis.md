# Batch H Analysis — Maintenance Accountability / Performance

## Item Matrix

| Item | Exists | Complete | Missing | Batch H Action |
|------|--------|----------|---------|---------------|
| MaintenancePersonnel model | NO | — | Full model | Create |
| MachineResponsibilityAssignment model | NO | — | Full model | Create |
| MaintenanceRequestAssignment model | NO | — | Full model | Create |
| MaintenancePartAccountability model | NO | — | Full model | Create |
| Machine responsibility history | NO | — | Via MachineResponsibilityAssignment | Create |
| Request assignment history | NO | — | Via MaintenanceRequestAssignment | Create |
| Part accountability history | NO | — | Via MaintenancePartAccountability | Create |
| Backend CRUD for maintenance personnel | NO | — | Full module | Create |
| Backend CRUD for machine responsibility | NO | — | Full module | Create |
| Backend CRUD for request assignment | NO | — | Full module | Create |
| Backend CRUD for part accountability | NO | — | Full module | Create |
| Accountability dashboard endpoint | NO | — | New endpoint | Create |
| Performance indicators endpoint | NO | — | New endpoint | Create |
| Machine detail responsibility section | NO | — | Frontend integration | Add |
| Maintenance request detail assignment section | PARTIAL | Existing `assign` method on request | Assignment lifecycle (accept/start/complete/cancel) | Add |
| Required parts accountability section | NO | — | Frontend section | Add |
| Personnel page | NO | — | Frontend page | Create |
| Machine responsibilities page | NO | — | Frontend page | Create |
| Accountability dashboard page | NO | — | Frontend page | Create |
| Permissions | NO | — | Seed entries for 4 new modules + reports | Add |
| i18n AR/EN | NO | — | Full key set | Add |
| F9 adapter for personnel | NO | — | New adapter | Create |
| API proof | NO | — | 50 tests | Execute |
| Browser proof | NO | — | 39 tests | Execute |
| Schema impact | NO | — | Migration | Apply |
| No stock movement | YES | — | Verify | Confirm |
| No finance entry | YES | — | Verify | Confirm |
| HR not activated | YES | — | Verify | Confirm |

## Summary

Batch H requires:
- 4 new Prisma models
- 1 new SQL Server migration
- 4 new NestJS modules (personnel, machine-responsibilities, request-assignments, part-accountability)
- 1 dashboard/performance module
- Permissions seed updates
- i18n AR/EN keys (~120+ new keys)
- 1 new F9 adapter
- 3 new frontend pages + 3 section integrations
- API proof (50 tests)
- Playwright browser proof (39 tests)
- 17 proof documents
