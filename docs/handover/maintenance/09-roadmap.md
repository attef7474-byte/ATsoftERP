# Handover Document 9: Roadmap & Future Work

## 1. Completed Stages

The following batches have been completed and are documented in their respective proof directories under `docs/proofs/`:

| Batch | Description | Commit / Tag |
|-------|-------------|--------------|
| **DX-0** | API Module Registry + Frontend Route Alignment | — |
| **I18N-0** | API Messages Foundation + Frontend i18n Cleanup | — |
| **NX** | Numbering Centralization + Sequence UI Completion | `4296675`, tagged `atsoft-erp-nx-numbering-centralization-sequence-ui` |
| **UX-0** | Organization Context Lite + Maintenance Auto-Fill | — |
| **Z-AA** | Spare Part Condition Balance + Removed Part Return | — |
| **AB-AC** | Installed Parts Register + Replacement History | `874f7be`, tagged `atsoft-erp-abac-installed-parts-replacement-history` |
| **AD-AE** | Repairable Spare Parts Workflow + Overhaul | `c4b87ff`, tagged `atsoft-erp-adae-repairable-spareparts-overhaul` |
| **AF-AG** | Maintenance Cost Reports + KPIs + Reliability | — |
| **AH-AI** | BOM Versioning + Preventive Spare Parts Planning | `f603aec` (current HEAD) |
| **AJ-AK** | Final Audit + SOP + Training + Handover | **CURRENT** |

### Key Outcomes Per Completed Batch

**NX**: Centralized all numbering into `NumberingService.generateNumberAtomic()`. Eliminated 24 bypass instances. Created `numbering.constants.ts`. 45 entity types (37 active).

**Z-AA**: Implemented `SparePartConditionBalance` and `SparePartConditionMovement` as side-ledger models. InventoryBalance unchanged. Removed part return flow.

**AB-AC**: Added `MachineInstalledPart` (26 cols) + `SparePartReplacementHistory` (24 cols). Auto-records installed parts on stock issue. 10 read-only GET endpoints.

**AD-AE**: Added `SparePartRepairOrder` (48 cols) + `SparePartRepairAction` (12 cols). 17 endpoints, 7 status transitions, condition conversion. Duplicate guard by replacementHistoryId.

**AF-AG**: Cost reports, KPIs (MTBF, MTTR, Availability), reliability calculations, operational cost reporting.

**AH-AI**: BOM versioning (draft→pending→approved→superseded), preventive spare part planning, infrastructure for future BOM activation.

## 2. Recommended Future Work (Priority Order)

### UI-QA — CRUD/DataGrid/Layout/Test Standardization (NEXT PLANNED)

**Objective**: Standardize frontend patterns, improve test coverage, resolve inconsistencies.

**Scope**:
- Standardize CRUD pattern (choose modal vs standalone)
- Standardize DataGrid vs DataTable usage
- Implement nested layouts for maintenance sections
- Add Playwright tests for critical flows
- Fix the 5 unimplemented i18n namespaces
- Add test coverage for key backend services
- Clean up unused/orphan code

**Dependencies**: All previous batches completed.

## 3. Future Enhancement Candidates (Outside Current Scope)

These features are **not** planned for the current release but are candidates for future development:

### 3.1 Activate BOM for Production Use
- Enable BOM pages in sidebar
- Approve BOM versions for use
- Wire BOM into stock planning and preventive maintenance

### 3.2 Accounting Integration
- Create accounting journals for stock issues
- Track maintenance costs in general ledger
- Depreciation integration for machine assets

### 3.3 Purchasing Integration
- Auto-create purchase requisitions when spare parts stock is low
- Link repair orders to purchase orders for external repairs
- Supplier management for spare parts procurement

### 3.4 Mobile Application
- Technician mobile app for task assignment and completion
- Barcode/QR scanning for spare parts and machines
- Offline support for field work

### 3.5 IoT Sensor Integration
- Real-time machine monitoring
- Condition-based maintenance triggers
- Automated alerting on threshold breaches

### 3.6 Predictive Maintenance (ML)
- Failure prediction models
- Optimal maintenance scheduling based on usage data
- Pattern recognition from historical downtime data

### 3.7 BI Dashboards
- Advanced analytics dashboards
- Custom report builder
- Executive KPIs with drill-down

### 3.8 Notification System Enhancement
- Implement notification triggers for maintenance events
- Email/SMS notifications for overdue tasks
- Push notifications for mobile app

### 3.9 Barcode/QR Label Printing
- Generate and print barcode/QR labels for machines and spare parts
- Mobile scanning for inventory verification

### 3.10 Multi-Language Expansion
- Add support for additional languages (French, Turkish, etc.)
- RTL/LTR layout improvements

## 4. Maintenance Roadmap

### Regular Updates
- **Dependencies**: Review and update npm packages quarterly
- **Prisma**: Update Prisma CLI and client with major version bumps
- **NestJS/Next.js**: Stay within active LTS versions
- **Security patches**: Apply critical patches immediately

### Bug Fixes
- Track issues via GitHub Issues
- Prioritize critical bugs (data loss, security, broken workflows)
- Regular patch releases for non-critical issues

### Performance Optimization
- Database query optimization (N+1 queries, indexing)
- API response time monitoring
- Frontend bundle size optimization
- Lazy loading for large pages

### Documentation
- Keep handover docs up to date with each release
- Maintain proof docs for each batch
- Update AGENTS.md when project rules change

## 5. Upgrade Paths

### NestJS Upgrade
```powershell
# Check current version
cd apps/api && npx nest info

# Upgrade
npm install @nestjs/core@latest @nestjs/common@latest @nestjs/platform-express@latest
# Check breaking changes and update code accordingly
```

### Next.js Upgrade
```powershell
# Check current version
cd apps/web && npx next info

# Upgrade
npm install next@latest react@latest react-dom@latest
# Check breaking changes and update code accordingly
```

### Prisma Upgrade
```powershell
cd apps/api
npm install prisma@latest @prisma/client@latest
npx prisma generate
# Check for any schema deprecations
```

**Important**: Always test upgrades in a development environment first. Create a database backup before upgrading Prisma or running new migrations.
