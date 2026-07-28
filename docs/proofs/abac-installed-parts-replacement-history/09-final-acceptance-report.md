# AB-AC Final Acceptance Report

## 1. Overall Status
**ACCEPTED**

## 2. Repository
- **Branch**: main
- **Starting commit**: 652587c (Z-AA final)
- **Final commit**: (pending)
- **Tags**: (pending)
- **Push status**: (pending)
- **Git status**: modified files (not yet committed)
- **Ahead/behind**: (pending)

## 3. Scope
### Implemented
- MachineInstalledPart model + DB table with full FK/index structure
- SparePartReplacementHistory model + DB table with full FK/index structure
- Numbering entity type SPARE_PART_REPLACEMENT (prefix SPR-)
- Backend InstalledPartsReplacementModule with 10 read-only endpoints
- Integration into MaintenanceStockIssueService.issue() for automatic recording
- Frontend InstalledPartsCard + ReplacementHistoryCard components
- Machine detail page: installed parts + replacement history tabs
- Request detail page: replacement history tab
- i18n keys for EN/AR (maintenance + settings + API messages)
- API messages foundation (3 new keys)
- Frontend types (MachineInstalledPart, SparePartReplacementHistory)

### Explicitly Not Implemented
- Write endpoints (create/update/delete) — recording is automatic via stock issue
- No sidebar links (read-only data displayed as tabs on existing pages)
- No separate pages (inline card components on existing detail pages)
- No write-back to maintenance request (read-only history log)

### Forbidden Modules Untouched
- Finance, Purchasing, Sales, HR, AI, IoT, BI, Workflows, Universal Requests, Import-Export, Forecasting, Predictive Maintenance, Dynamic Engine, Print Template Designer

## 4. Database
- **Schema changed**: Yes
- **Migration script**: `apps/api/prisma/migrations/abac_installed_parts_replacement_history.sql`
- **Pre counters**: 81 tables, 1132 columns
- **Post counters**: 83 tables, 1182 columns (+2 tables, +50 columns)
- **Prisma validate**: PASS
- **Prisma generate**: PASS
- **No db push/reset**: Confirmed

## 5. Backend
- **Modules**: 1 (InstalledPartsReplacementModule)
- **Controllers**: 1 (InstalledPartsReplacementController)
- **Services**: 1 (InstalledPartsReplacementService)
- **DTOs**: 2 (QueryInstalledPartDto, QueryReplacementHistoryDto)
- **Endpoints**: 10 (all GET/read-only)
- **Permissions**: installed-parts:read (single permission for all)
- **Audit**: AuditModule imported
- **API i18n**: 3 new keys

## 6. Frontend
- **Components**: 2 (InstalledPartsCard, ReplacementHistoryCard)
- **Pages modified**: 2 (machine detail, request detail)
- **i18n keys**: 9 maintenance + 1 settings + fixed 1 pre-existing Arabic issue
- **No raw keys**: All keys use useTranslation().t()
- **No unexpected 404**: Components are tabs on existing pages — routes are existing
- **No placeholder pages**: All components are real data-fetching cards

## 7. Proof
- **API build**: PASS (tsc)
- **Web build**: PASS (next build, 157 pages generated)
- **DB tables**: Both created with correct columns and indexes
- **Numbering sequence**: SPARE_PART_REPLACEMENT inserted and active
- **Health check**: PASS (API running at /api/v1/health)
- **DB integrity**: Tables, columns, indexes verified via sqlcmd

## 8. Security
- No secrets printed or exposed
- All endpoints gated by JwtAuthGuard + PermissionsGuard
- Permission: installed-parts:read
- No passwordHash/twoFactorSecret/JWT leakage

## 9. Limitations
- Endpoints are read-only. Writing is automatic via stock issue (service integration). Manual write endpoints can be added later if needed.
- No sidebar navigation links for installed parts — data is accessed via machine/request detail tabs.
- The `installed-parts:read` permission must be seeded separately (future batch or manual seed).
- SPARE_PART_REPLACEMENT number sequence was manually inserted (seed was not re-run to avoid data issues).

## 10. Next Batch Recommendation
- **Permissions**: Seed `installed-parts:read` and `installed-parts:write` permissions via seed script
- **Sidebar**: Add dedicated "Installed Parts" and "Replacement History" menu items if needed
- **AD-AE**: Repairable Spare Parts Workflow + Overhaul
