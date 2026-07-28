# ATsoft ERP — AGENTS.md

> **آخر تحديث**: 2026-07-28  
> **الغرض**: سياق دائم للجلسات المستقبلية — يمنع إعادة اكتشاف المعلومات

---

## 📋 القواعد الثابتة (Global Rules)

```yaml
database:   SQL Server 2016 Express (127.0.0.1:50079, DB=ATsoftERP_DB, user=atsofterp_app)
runtime:    Windows local only
docker:     FORBIDDEN
postgresql: FORBIDDEN
prisma_migrate_dev: FORBIDDEN
prisma_db_push: FORBIDDEN
prisma_migrate_reset: FORBIDDEN
delete_data: FORBIDDEN
drop_tables: FORBIDDEN
mock_apis: FORBIDDEN
placeholder_pages: FORBIDDEN
screenshots: DISABLED_BY_USER
commit_per_lane: FORBIDDEN  # commit/tag/push only after full proof
```

### التنقل بين الملفات

```
API:      apps/api/src/
Frontend: apps/web/src/
Prisma:   apps/api/prisma/schema.prisma
Seed:     apps/api/prisma/seed/seed.ts
i18n EN:  apps/web/src/lib/i18n/locales/en/
i18n AR:  apps/web/src/lib/i18n/locales/ar/
Docs:     docs/proofs/
```

### البنية الأساسية

- **API**: NestJS (TypeScript) — 71 modules registered in `app.module.ts`
- **Frontend**: Next.js (TypeScript) — ~250 page.tsx files
- **DB**: Prisma ORM → SQL Server via `sqlcmd` for manual migrations
- **i18n**: React Context (I18nProvider) — 13 TS files × 2 languages (~2,977 keys each)
- **Auth**: JWT-based with role/permission guards

---

## 🧭 Instruction Priority

When working in this repository, follow instructions in this order:

1. Current user request in the active task.
2. AGENTS.md global rules and forbidden rules.
3. Batch-specific prompt.
4. Existing project architecture and code patterns.
5. General best practices.

If a task request conflicts with any hard forbidden rule in AGENTS.md, STOP and report BLOCKED.

Do not silently override:
- database/runtime rules
- forbidden modules
- destructive database rules
- no mock/no placeholder rules
- no screenshots rule
- no partial commit/push rule
- current release scope limitations

If unsure whether an action violates the rules, do not guess. Stop, document the risk, and ask for confirmation.

---

## ✅ Acceptance Status Policy

Allowed final statuses:

### ACCEPTED

Use only when all required conditions are true:

- implementation complete
- API proof complete
- Browser/DOM proof complete
- DB integrity proof complete when DB is touched
- health check PASS
- smoke test PASS
- build/typecheck PASS
- i18n check PASS when UI/API messages changed
- git status clean
- commit created when the task explicitly requires commit
- tags created and pushed when the task explicitly requires tags
- branch pushed when the task explicitly requires push
- no undocumented limitations
- no hidden broken flows
- no unexpected 404 from active frontend pages

Never call a batch ACCEPTED based only on build success.

### ACCEPTED_WITH_DOCUMENTED_LIMITATION

Use only when:

- implementation is complete
- all required validation passes
- limitation is real, documented, and not hiding a broken user-facing flow
- limitation is outside current scope or environmental/runtime-only
- the user-facing operational path is not broken

### PARTIAL

Use when any of the following is true:

- implementation is incomplete
- proof incomplete
- some routes/pages fail
- git not clean when a clean final state is required
- tags not pushed when tags are required
- health/smoke failed
- API/browser proof missing
- DB integrity proof missing after DB changes
- i18n keys are unbalanced after UI/API message changes

### BLOCKED

Use when:

- required dependency is missing
- DB/runtime unavailable
- task conflicts with forbidden rules
- schema/migration risk cannot be resolved safely
- user decision is required
- a required module is forbidden for current release
- safe proof cannot be produced

Final status must be honest. Do not hide failures inside long reports.

---

## 🧩 Module Activation Policy

Do NOT register a module in `app.module.ts` just because code exists on disk.

Each module must be classified before any activation:

### ACTIVE_REGISTERED

Already registered and verified at runtime.

### READY_TO_REGISTER

May be registered only if all are true:

- inside current approved release scope
- controller/service/DTOs are complete
- real frontend dependency exists
- permissions are defined
- i18n keys exist
- API proof possible
- Browser proof possible
- no dependency on forbidden modules
- no mock/placeholder flow

### USER_REJECTED_FOR_CURRENT_RELEASE

Must not be:

- registered in `app.module.ts`
- mounted in runtime
- linked in sidebar/navigation
- counted as completion
- shown as active in dashboard
- used by frontend API calls

Current rejected modules include:

- Finance
- Purchasing
- Sales
- HR
- AI
- IoT
- BI
- Workflows
- Universal Requests
- Import-Export
- Forecasting
- Predictive Maintenance
- Print Template Designer
- any other module explicitly rejected by the user

### LEGACY_UNUSED

Existing old code, not active, not called by frontend, and not part of current release.

### BROKEN_REQUIRES_FIX

Code exists but cannot be safely activated.

Hard rules:

- No frontend page may call an endpoint from an unregistered module.
- No sidebar link may point to a rejected or unregistered module.
- No placeholder API may be created to hide 404.
- No forbidden module may be activated to satisfy a route.
- If a page depends on a forbidden module, hide or document the page instead of activating the module.

---

## 🛣️ Frontend/API Route Alignment Rules

Before adding new features:

1. Scan all frontend API calls.
2. Confirm corresponding API runtime route exists.
3. Confirm route is visible in Swagger or runtime route map.
4. Confirm no unexpected 404.
5. Ensure API paths use leading `/` consistently.
6. Do not leave frontend buttons calling missing endpoints.
7. Do not hide broken endpoints with mock responses.
8. Do not create fake success responses.
9. Do not leave disabled buttons unless disabled by permission or documented workflow state.
10. Do not mount pages for rejected modules.

Every batch that changes routes must update:

- route map
- API proof
- browser/DOM proof
- navigation/sidebar proof
- 404 proof

A frontend route is not accepted until its API dependencies are active and proven.

---

## 🔢 Numbering Hard Rules

All generated codes/numbers must use:

`NumberingService.generateNumberAtomic()`

Forbidden:

- direct `prisma.numberSequence.findUnique()` for generation
- manual `currentNumber + 1`
- manual prefix/suffix formatting inside business services
- frontend-generated codes
- editable codes after creation
- consuming numbers during preview
- consuming numbers on failed validation
- generating a new code during edit/update
- creating entity-specific numbering logic outside NumberingService

Required:

- generation must be backend-only
- generation must be transaction-safe
- `currentNumber` must update atomically
- `lastGeneratedCode` must update
- preview must not consume numbers
- edit must not generate a new number
- code/number must be immutable after creation
- every entityType must exist in seed + UI filter + i18n
- no duplicate codes
- failed validation must not consume a number
- API errors must use localized message keys
- frontend must show generated codes as read-only after creation

Target services known to require centralization include:

- inventory-movements.service.ts
- inventory-counts.service.ts
- inventory-adjustments.service.ts
- inventory-opening-balances.service.ts
- inventory-stock-adjustments.service.ts
- inventory-stock-transfers.service.ts
- inventory-operational-receipts.service.ts
- inventory-physical-counts.service.ts
- maintenance-requests.service.ts
- preventive-maintenance.service.ts
- maintenance-schedules.service.ts
- barcode-labels.service.ts
- maintenance-stock-issue.service.ts

If new services generate numbers, they must use NumberingService from the start.

---

## 🌐 API i18n Rules

API errors must not be English-only.

Every new user-facing API error should return:

- `messageKey`
- localized `message`
- safe `details` only when needed

Language resolution order:

1. `x-locale`
2. `Accept-Language`
3. user preference if available
4. fallback: `ar`

Forbidden:

- raw English-only exceptions for user-facing errors
- leaking stack traces
- leaking SQL errors
- leaking secrets
- returning untranslated enum names to Arabic UI unless intentionally technical
- returning Prisma/Nest internal messages directly to users

Required:

- API message keys must be stable.
- Arabic and English messages must both exist.
- Frontend should display localized API messages when available.
- New frontend text must have EN and AR keys.
- No raw i18n keys may appear in browser proof.

Priority message domains:

- auth
- validation
- numbering
- maintenance
- stock
- inventory
- permissions
- organization context

---

## 🗄️ SQL Server Migration Safety

Allowed:

- inspect schema first
- create safe SQL Server migration scripts manually when needed
- run migration using `sqlcmd`
- run `npx prisma validate`
- run `npx prisma generate`
- verify tables/enums/indexes after migration
- document pre/post DB counters

Forbidden:

- `prisma db push`
- `prisma migrate reset`
- `prisma migrate dev`
- database reset
- table drop
- deleting seed data
- destructive re-seeding
- changing existing data without documented backfill plan
- destructive column changes without proof and explicit approval

Schema changes require:

1. preflight DB counters
2. migration script
3. rollback/mitigation note when possible
4. post-migration DB counters
5. Prisma validate/generate
6. API build
7. DB integrity proof
8. data-loss assessment
9. no forbidden module activation

If migration safety is unclear, report BLOCKED.

---

## 🧰 Inventory/Maintenance Stock Safety

Current inventory balance model is Product-based.

Do not change `InventoryBalance` structure unless a dedicated approved batch explicitly requires it.

For spare part condition tracking, use side ledger models:

- `SparePartConditionBalance`
- `SparePartConditionMovement`

Hard rules:

- no double deduction
- no direct manual balance edits from UI
- no stock movement outside a transaction
- maintenance issue must use SPARE_PART warehouse only
- PRODUCT warehouse must be blocked for maintenance spare part issue
- RAW_MATERIAL warehouse must be blocked for maintenance spare part issue
- planning/reservation must not deduct stock
- actual issue only deducts stock
- repair workflow must not create Finance/Purchasing entries
- cost reporting is operational only, not accounting
- do not create accounting journals
- do not create purchase orders
- do not create supplier invoices

Required proof for stock-related batches:

- before/after InventoryBalance
- before/after condition balance when applicable
- InventoryMovement proof when applicable
- SparePartConditionMovement proof when applicable
- no double deduction proof
- blocked warehouse proof
- DB integrity proof
- audit proof

---

## 🧑‍🏭 UX Simplification Rules

Daily users must not manually enter fields that the system can derive.

Hide from daily maintenance forms:

- companyId
- branchId
- departmentId
- productionLineId
- costCenterId
- productId behind sparePartId
- warehouseType
- technicalClassification
- usageType
- importance
- generated codes/numbers
- audit fields
- workflow status fields unless shown read-only

System must derive:

- company/branch from current context
- department/line/cost center from selected machine
- unit/component list from selected machine
- spare part classification from SparePart
- Product link from `SparePart.productId`
- available condition balance from stock ledger
- totalCost from quantity × unitCost
- requestNumber/code from NumberingService
- createdBy/updatedBy from current user
- timestamps from backend

User should normally enter/select only:

- machine
- component/unit
- spare part
- quantity
- warehouse filtered to SPARE_PART
- issued condition
- replacement action
- removed part details only when required
- notes
- reason when required
- receivedBy when required

UX priority:

1. reduce repeated data entry
2. use F9/search for long lists
3. use filtered dropdowns by context
4. show read-only derived fields
5. show clear Arabic API errors
6. support bulk add where useful
7. do not expose internal IDs to users

---

## ⚙️ Parallel Execution Rules

Work may be organized into lanes, but commit/tag/push happens only after all lanes are merged and validated.

Allowed lanes:

- Lane A: Schema / Migration / DB Safety
- Lane B: Backend / API / Services
- Lane C: Frontend / UX / Routes
- Lane D: i18n / Permissions / Audit
- Lane E: API / Browser / DB Proof
- Lane F: Documentation / Closeout

Ownership:

- `schema.prisma` = Lane A only
- migration scripts = Lane A only
- shared backend services = one owner only
- i18n files = Lane D only
- sidebar/navigation = one owner only
- proof docs = Lane E/F
- app.module.ts = DX/module registry owner only
- NumberingService = NX owner only

Merge gates:

1. Preflight clean
2. Analysis complete
3. Schema/migration complete
4. Backend API stable
5. Frontend wired
6. i18n/permissions/audit complete
7. proof complete
8. validation complete
9. final report complete
10. commit/tag/push complete if requested

No lane may commit independently.
No lane may push independently.
No lane may bypass validation.

---

## 📄 Proof Documentation Standard

Every batch must create proof docs under:

`docs/proofs/<batch-slug>/`

Minimum required files:

- `00-summary.md`
- `01-scope-and-rules.md`
- `02-implementation-map.md`
- `03-api-proof.md`
- `04-browser-dom-proof.md`
- `05-db-integrity-proof.md` when DB touched
- `06-i18n-proof.md` when UI/API messages changed
- `07-permissions-audit-proof.md` when permissions/audit changed
- `08-validation-report.md`
- `09-final-acceptance-report.md`

Screenshots are disabled by user.

Use instead:

- Playwright/browser DOM assertions
- route status proof
- console error proof
- network request proof
- API response proof
- DB counter proof
- SQL read-only verification
- build/typecheck logs
- health/smoke logs

A proof document must state what was tested, how it was tested, and the result.

---

## 🧾 Required Batch Report Template

Every batch final report must include:

1. Overall status:
   - ACCEPTED
   - ACCEPTED_WITH_DOCUMENTED_LIMITATION
   - PARTIAL
   - BLOCKED

2. Repository:
   - branch
   - starting commit
   - final commit
   - tags
   - push status
   - git status
   - ahead/behind

3. Scope:
   - implemented
   - explicitly not implemented
   - forbidden modules untouched

4. Database:
   - schema changed yes/no
   - migration name/script
   - pre/post counters
   - Prisma validate/generate
   - no db push/reset confirmation

5. Backend:
   - modules/controllers/services/DTOs
   - endpoints
   - permissions
   - audit
   - API i18n messages

6. Frontend:
   - routes/pages/components
   - i18n
   - no raw keys
   - no unexpected 404
   - no placeholder pages

7. Proof:
   - API proof count
   - Browser proof count
   - DB integrity
   - health/smoke
   - build/typecheck

8. Security:
   - no secrets printed
   - no passwordHash/twoFactorSecret/JWT leakage
   - permission checks

9. Limitations:
   - documented limitations only
   - no hidden broken flows

10. Next batch recommendation.

---

## ♻️ Stale Facts Rule

Numbers in AGENTS.md are baseline facts, not permanent truth.

Before each batch, re-check:

- registered modules count
- route map
- i18n key counts
- Numbering sequences
- services bypassing NumberingService
- git status
- DB counters
- frontend route/API call map
- active/rejected module list
- current branch/commit/tag state

If actual code differs from AGENTS.md:

1. document the difference
2. continue based on current code
3. do not violate global rules
4. do not silently overwrite AGENTS.md facts unless the task is to update them

---

## 🔐 Security and Secrets Rules

Never print, commit, or expose:

- DATABASE_URL
- JWT secret
- password hashes
- two factor secrets
- refresh tokens
- access tokens
- API keys
- SMTP passwords
- connection strings with passwords
- private certificates

When proof requires authentication:

- use safe test credentials only if already configured locally
- do not write real passwords in reports
- mask secrets in logs
- never include `.env` contents in proof docs

API errors must not leak:

- SQL Server errors
- Prisma raw exceptions
- stack traces
- internal file paths
- sensitive user fields

---

## 🔒 Current Release Scope Lock

Current approved release scope includes:

- Auth
- Access Control
- Companies
- Branches
- Administrations
- Departments
- Warehouses
- Locations
- Products
- Inventory operational flows
- Maintenance/CMMS operational flows
- Barcode/QR operational support
- Basic reports
- Audit
- Notifications/settings where already active
- Backup/restore/runtime support where already active

Current release explicitly excludes:

- Sales
- Purchasing
- Finance
- HR
- AI Assistant
- IoT
- BI
- Forecasting
- Predictive Maintenance
- Dynamic Engine
- Workflows
- Universal Requests
- Import/Export Designer
- Print Template Designer

Excluded modules may exist on disk but must remain inactive until the user approves a separate review and activation batch.

---

## 🗂️ Current Priority Plan Enforcement

The next work must follow this order unless the user explicitly changes priority:

1. DX-0 — API Module Registry + Frontend Route Alignment
2. I18N-0 — API Messages Foundation + Frontend i18n Cleanup
3. NX — Numbering Centralization + Sequence UI Completion
4. UX-0 — Organization Context Lite + Maintenance Auto-Fill
5. Z-AA — Spare Part Condition Balance + Removed Part Return
6. AB-AC — Installed Parts Register + Replacement History
7. AD-AE — Repairable Spare Parts Workflow + Overhaul
8. AF-AG — Maintenance Cost Reports + KPIs + Reliability
9. AH-AI — BOM Versioning + Preventive Spare Parts Planning
10. AJ-AK — Maintenance Final Audit + SOP + Training + Handover
11. UI-QA — CRUD/DataGrid/Layout/Test Standardization

Do not start Z-AA before DX-0, I18N-0, NX, and UX-0 are accepted or explicitly skipped by the user.

---

## 📝 Documentation-Only Task Rules

For documentation-only tasks:

Allowed:

- edit markdown files
- update planning docs
- update proof docs
- update AGENTS.md
- run git diff/status

Forbidden:

- application code changes
- schema changes
- package changes
- migrations
- database commands
- module activation
- frontend route changes
- API route changes
- dependency installation

If documentation-only scope expands into code changes, STOP and report BLOCKED.

---

## 🏗️ Batch History

### ✅ Batch Y (COMPLETED — commit `31858ee`)
Maintenance spare part classification + cost attribution + warehouse types

**Tags:**
- `atsoft-erp-maintenance-sparepart-classification-cost-attribution`
- `atsoft-erp-current-release-final-audited-v3-maintenance-sparepart-structure`
- `atsoft-erp-maintenance-sparepart-classification-proof`

### ✅ NX (COMPLETED — commit `<final>`)
Numbering centralization + sequence UI completion

**Tags:**
- `atsoft-erp-nx-numbering-centralization-sequence-ui`
- `atsoft-erp-current-release-final-audited-v3-nx-numbering`
- `atsoft-erp-nx-numbering-proof`

**Key outcomes:**
- 24 numbering bypass instances eliminated (13 services converted)
- `numbering.service.ts` hardened with `ACTIVE` status check
- `numbering.constants.ts` created as single source of truth for 44 entity type codes
- UI filter now covers all 36 active-release entity types
- 10 missing i18n keys added to EN/AR
- Zero `numberSequence` access outside `numbering.service.ts`
- 24 services now use `NumberingService.generateNumberAtomic()`

### 📋 Final Priority Plan — 11 Stages

```
DX-0   = API Module Registry + Frontend Route Alignment
I18N-0 = API Messages Foundation + Frontend i18n Cleanup
NX     = Numbering Centralization + Sequence UI Completion
UX-0   = Organization Context Lite + Maintenance Auto-Fill
Z-AA   = Spare Part Condition Balance + Removed Part Return
AB-AC  = Installed Parts Register + Replacement History
AD-AE  = Repairable Spare Parts Workflow + Overhaul
AF-AG  = Maintenance Cost Reports + KPIs + Reliability
AH-AI  = BOM Versioning + Preventive Spare Parts Planning
AJ-AK  = Maintenance Final Audit + SOP + Training + Handover
UI-QA  = CRUD/DataGrid/Layout/Test Standardization
```

### 🚫 الوحدات الممنوعة من التفعيل في جميع الدفعات

```
Finance (المالية)
Purchasing (المشتريات)
Sales (المبيعات)
HR (الموارد البشرية)
AI (الذكاء الاصطناعي)
IoT (إنترنت الأشياء)
BI (ذكاء الأعمال)
Workflows (سير العمل)
Universal Requests (الطلبات العامة)
Import-Export (استيراد/تصدير)
Forecasting (التنبؤ)
```

---

## 🔍 Key Technical Findings

### API Module Registry (`app.module.ts` — 71 modules)

**Registered modules** (active at runtime):
- Core: Auth, Users, Roles, Permissions, Companies, Branches, Administrations, Departments
- Factory: Products, ProductCategories, Inventory, Maintenance (and all sub-modules)
- Inventory: Counts, CountLines, Movements, Adjustments, Balances, Ledger, OpeningBalances, StockAdjustments, StockTransfers, OperationalReceipts, PhysicalCounts, Locks
- Maintenance: MachineCategories, MachineParts, MachineDocuments, Requests, Tasks, Schedules, ChecklistItems, DowntimeLogs, RequestParts, RequestCosts, ChecklistExecutions, Dashboard, PreventiveMaintenance, OperationTypes, CostCenters, ProductionLines, MachineComponents, SpareParts, ComponentSpareParts, MachineSpareParts, Personnel, ResponsibilityAssignments, RequestAssignments, PartAccountability, Reliability, SparePartRequestLines, Notification, Sla, CalendarWorkload, StockIssue
- Other: Barcodes, BusinessPartners, Audit, Numbering, Notifications, Search, Reports, Dashboard, Alerts, Messaging, Attachments
- Settings: SystemSettings, CompanyProfile, Language, Appearance, Security, NotificationRules

**Unregistered modules** (code exists but NOT loaded):
- AI, Approvals, Backups, BI, BusinessRules, Dynamic, Finance, FinancialDisbursementRequests, Forecasting, HR, HRRequests, ImportExport, InventoryIssueRequests, IoT, Monitoring, PredictiveMaintenance, PrintTemplates, Purchasing, Sales, Settings(parent), SystemHealth, SystemUpdate, UniversalRequests, Workflows, Admin/AccessControl, Factory/BOM, Factory/Materials, Factory/MaterialCategories, Factory/Units, Factory/Quality, Factory/Production, Documents(parent)

### i18n System

| Metric | Value |
|--------|-------|
| Total EN keys | 2,977 |
| Total AR keys | 2,977 |
| EN/AR match | 100% (identical keys in all 12 files) |
| Coverage | ~99% UI, ~30% API foundation (46 keys in 9 domains) |
| Provider | React Context → returns raw key if not found |
| Files | 13 TS files/en + 13 TS files/ar |
| API foundation | `api-messages.ts` + `get-request-language.ts` implemented in I18N-0 |
| Orphan JSON | `en-numbering.json` + `ar-numbering.json` (deleted in I18N-0 — content was duplicated in settings.ts) |
| Known bugs FIXED in I18N-0 | `ar/settings.ts` `OperationalPerson` → `موظفي الصيانة`; login hardcoded placeholder → i18n key |

### Numbering System

| Metric | Value |
|--------|-------|
| Seeded sequences | 44 (36 ACTIVE + 8 DISABLED) |
| Used by services | 24 of 36 active |
| Centralized service | `NumberingService.generateNumberAtomic()` |
| Entity type constant | `numbering.constants.ts` — 44 codes |
| UI filter coverage | All 36 active-release entity types |
| Sequence inactive check | Added to `generateNumber()` and `generateNumberAtomic()` |
| Services fully centralized | 24 services now use `NumberingService.generateNumberAtomic()` |
| Zero bypass instances | Confirmed by grep — all `numberSequence` access inside `numbering.service.ts` only |
| Orphan sequences | MACHINE_ASSET, MACHINE_DOCUMENT, MAINTENANCE_TASK, DOWNTIME, PREVENTIVE_MAINTENANCE, QR_LABEL, BARCODE_RECORD, BARCODE_PRINT_JOB, REPORT_EXPORT_JOB, ATTACHMENT, NOTIFICATION_RULE (still seeded but not yet consumed by any service — OK for future use) |

### Frontend Patterns

- **CRUD**: Two competing patterns — modal-based (core entities via `useCrudList`) vs standalone pages (newer entities)
- **Grids**: Mix of `AdminDataGrid` (rich) and `DataTable` (simple)
- **Layouts**: Only root + admin layouts; no nested layouts for sections
- **Tests**: Only 7 spec files across the entire project
- **Hardcoded strings**: 1 found (`placeholder="admin@atsofterp.com"` in login page)
- **API path bugs FIXED in DX-0**: 10 paths missing leading `/` (9 in inventory locks pages + 1 in governance-audit) — all now use `/inventory/locks` and `/inventory/audit` with proper leading slash

### i18n Namespace Gap
5 of 53 defined namespaces are NOT implemented:
`inventoryCounting`, `maintenanceDashboard`, `preventiveMaintenance`, `downtimeAnalysis`, `sparePartRequest`

---

## 🧪 Acceptance Criteria (standard per batch)

```yaml
health_check:    4/4 (API, DB, Web, Auth)
smoke_test:      8/8 (CRUD operations)
api_proof:       varies by batch (80-180+ endpoints)
browser_proof:   varies by batch (35-90+ screens)
db_integrity:    PASS
git_clean:       yes
tags_pushed:     yes
```

### Smoke Test Endpoints
```typescript
GET  /health
GET  /auth/profile
GET  /companies
POST /companies (with cleanup)
PATCH /companies/:id
DELETE /companies/:id
GET  /branches
GET  /departments
```

---

## 📁 Discovery Pack Location

```
External: C:\Users\attef\PycharmProjects\Trae\maintenance-completion-discovery-pack\
Internal: docs/proofs/maintenance-completion-discovery-pack/
```

### Current Files (14 total)
```
00-summary.md
01-schema-map.md
02-stock-model-inventory-balance.md
03-flow-map.md
04-api-endpoint-map.md
05-frontend-route-map.md
06-permissions-audit-map.md
07-database-counters.md
08-batch-y-fields.md
09-limitations-risks.md
10-next-batch-recommendations.md
11-parallel-execution-plan.md
12-models-fields-ux.md
13-i18n-audit-report.md
14-observations-suggestions.md
```

---

## ⚙️ Useful Commands

```powershell
# Start API
cd apps/api && npm run start:dev

# Start Web
cd apps/web && npm run dev

# Manual migration
sqlcmd -S 127.0.0.1,50079 -U atsofterp_app -P <password> -d ATsoftERP_DB -i migration.sql

# Prisma generate
cd apps/api && npx prisma generate

# Build checks
cd apps/api && npm run build        # typecheck included
cd apps/web && npm run build        # typecheck included
```

---

## 👤 Current User Context

```yaml
language: Arabic (primary)
working_dir: C:\Users\attef\PycharmProjects\Trae\ATsofterp
external_copy: C:\Users\attef\PycharmProjects\Trae\maintenance-completion-discovery-pack\
next_batch: UX-0 (Organization Context Lite + Maintenance Auto-Fill)
```
