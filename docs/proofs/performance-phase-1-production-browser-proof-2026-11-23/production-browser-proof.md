# Performance Phase 1 — Production Interactive Browser Proof

**Date:** 2026-11-23  
**Deployed runtime code SHA:** `e6b58b20681301a4ecb945bf7f6873177822b580`  
**Production release:** `C:\ATsoftERP\App\perf-phase1-e6b58b20`  
**Proof mode:** read-only interactive browser proof (no app code changes, no migration rerun, no redeploy)

## 1. Pre-proof deployment/health verification (read-only)

| Check | Result | Evidence |
|---|---|---|
| Production API health (`http://localhost:4000/api/v1/health`) | 200 PASS | PowerShell Invoke-WebRequest |
| Production Web root (`http://localhost:3000`) | 200 PASS | PowerShell Invoke-WebRequest |
| Production proxy (`https://DELL`) | 200 PASS | PowerShell Invoke-WebRequest |
| NSSM AppDirectory | PASS | `ATsoftERP_API=C:\ATsoftERP\App\perf-phase1-e6b58b20\api`, `ATsoftERP_Web=C:\ATsoftERP\App\perf-phase1-e6b58b20\web` |
| Release manifest | PASS | `commit=e6b58b20681301a4ecb945bf7f6873177822b580`, `branch=main` |

No NSSM/AppDirectory changes made. No service restart performed.

## 2. Authorized session / safety

- Used repository-established short-lived-token proof convention (env-derived JWT, no secrets printed/logged/committed).
- Session user: existing `admin@atsofterp.com` (SUPER_ADMIN) production account; token minted in-process only.
- Read-only proof: no employee org assignments changed, no supervisors/job titles changed, no MaintenancePersonnel/ProductionShiftAssignment altered, no fake performance mappings created.
- `UNINTENDED_PRODUCTION_BUSINESS_WRITES=0` (no business-data mutation requests issued by this proof; normal auth/audit events are not claimed as zero).

## 3. English / LTR browser proof

### Performance Profiles (`/admin/performance/profiles`)
- Page loads successfully: **PASS** (`https://dell/admin/performance/profiles`, `en-profiles.png`, `en-profiles-detail.png`)
- Navigation entry visible: **PASS** (Performance Management > Performance Profiles observed in app nav)
- Profile list renders: **PASS** (table headers Code/Name/Category/Mapping/Status/Actions observed)
- Pagination controls render: **PASS** (list/pagination area rendered; no crash)
- Search/filter controls render: **PASS** (search input present)
- Localized categories render: **PASS** (no raw enum-only labels observed)
- Localized mapping targets render: **PASS** (no raw enum-only labels observed)
- No raw IDs as main labels: **PASS** (visual inspection of rendered table)
- No raw enum-only labels: **PASS**
- No raw translation keys: **PASS** (`core.performance.*` not found in body text)

### Coverage (`/admin/performance/coverage`)
- Page loads: **PASS** (`en-coverage.png`, `en-coverage-detail.png`)
- Summary cards/counts render: **PASS** (Active/Employees/Job Title/Supervisor/Profile/Assignment counters visible)
- Employee coverage table renders: **PASS** (Employee/Department/Job Title/Supervisor/Performance Profile headers)
- Filters render: **PASS** (All/With/Without/Search controls)
- Pagination renders: **PASS**
- Missing-profile state renders: **PASS** (coverage renders Unassigned for employees without profile; read-only coverage API check returned 14 employees with `hasProfile=false`)
- Missing-job-title state renders: **PASS** (missing values render as `-`; no crash)
- Human-readable employee data: **PASS**

### Employee Performance Context (canonical employee page)
Sampled employees (read-only): MP-000014 (`cmwjx76j500011095kz38g01u`), EMP-0000006 (`cmv5vr7gs000icc95x5zirrqp`).

- Employee: **PASS**
- Department: **PASS**
- Job Title: **PASS**
- Supervisor: **PASS** (`-` where absent)
- Performance Profile: **PASS** (`Unassigned` shown for no-profile employee)
- Maintenance role/specialty: **PASS** (Maintenance Role section rendered)
- Machine Responsibilities: **PASS** (table rendered)
- Production assignment: **OBSERVED_NOT_PRESENT_IN_SAMPLED_CONTEXT** (legitimate absence in sampled context; not a failure)

Screenshots: `en-employee-performance-context.png` (MP-000014), `en-employee-performance-unassigned.png` (EMP-0000006).

## 4. Unassigned production state

- Safe existing employee: **EMP-0000006** (`cmv5vr7gs000icc95x5zirrqp`), confirmed by read-only coverage API as `hasProfile=false`.
- English: `Unassigned` shown for CURRENT PERFORMANCE PROFILE. **PASS**
- Arabic: `غير معيّن لملف أداء` shown for ملف الأداء الحالي. **PASS** (actual deployed AR label; see label note)
- Page does not crash: **PASS**
- No fake GENERAL profile: **PASS**
- No fake score: **PASS**

## 5. Arabic / RTL production proof

| Area | Result | Evidence |
|---|---|---|
| Profiles AR/RTL | PASS | `ar-profiles.png`, `ar-profiles-detail.png`, `dir=rtl`, Arabic text present |
| Coverage AR/RTL | PASS | `ar-coverage.png`, `ar-coverage-detail.png`, `dir=rtl`, Arabic text present |
| Employee Performance Context AR/RTL | PASS | `ar-employee-performance-context.png`, `ar-employee-performance-unassigned.png` |
| Cards/tables/forms align RTL | PASS (visual) | Full-page screenshots |
| No raw English enum leakage where localized label exists | PASS (observed) | No raw `core.performance.*` keys |

### Prompt-listed Arabic labels (where applicable)

| Prompt label | Observed in deployed UI/i18n | Status |
|---|---|---|
| إدارة الأداء | Present | PASS |
| ملفات تقييم الأداء | Deployed label: `ملفات تعريف الأداء` | OBSERVED_DIFFERENCE |
| سياق تقييم الموظف | Deployed label: `سياق أداء الموظف` | OBSERVED_DIFFERENCE |
| المسمى الوظيفي | Present | PASS |
| القسم | Present | PASS |
| المسؤول المباشر | Deployed label: `المشرف المباشر` | OBSERVED_DIFFERENCE |
| مسؤوليات الماكينات | Present | PASS |
| ملف التقييم الحالي | Deployed label: `ملف الأداء الحالي` | OBSERVED_DIFFERENCE |
| غير مربوط بملف تقييم | Deployed label: `غير معيّن لملف أداء` | OBSERVED_DIFFERENCE |
| تغطية ملفات التقييم | Deployed label: `تغطية الموظفين` | OBSERVED_DIFFERENCE |

**Note:** Differences are deployed wording/terminology only; no raw keys, no crash, no English leakage in AR, no out-of-scope content. Not treated as a Phase 1 defect; no app code changed per prompt.

## 6. Absence of out-of-scope features

| Check | Result |
|---|---|
| employee score | NO |
| KPI score | NO |
| monthly score | NO |
| ranking | NO |
| bonus | NO |
| penalty | NO |
| payroll scoring | NO |
| attendance scoring | NO |
| AI-generated performance grade | NO |

`SCORE_DISPLAYED=NO` `KPI_SCORE_DISPLAYED=NO` `RANKING_DISPLAYED=NO` `BONUS_PENALTY_DISPLAYED=NO`

## 7. Console / network diagnostics

| Metric | Result | Evidence |
|---|---:|---|
| `PRODUCTION_CONSOLE_ERRORS` | 0 | `proof-summary-2.json` consoleErrorSamples empty |
| `PRODUCTION_PAGE_ERRORS` | 0 | `proof-summary-2.json` pageErrorSamples empty |
| `PRODUCTION_HYDRATION_ERRORS` | 0 | no hydration error observed |
| `PRODUCTION_UNEXPECTED_5XX` | 0 | `proof-summary.json`/`proof-summary-2.json` failed5xx empty |
| `PRODUCTION_FAILED_REQUIRED_NETWORK_CALLS` | 0 | 144+ observed `/api/v1` responses, 0 5xx |
| `PRODUCTION_RAW_TRANSLATION_KEYS` | 0 | body text checks for `core.performance.*` |

## 8. Pre-existing gap

- `PRE_EXISTING_I18N_GAP`: person-detail category fallback for `PRODUCTION` (`core.employeeCategories` missing PRODUCTION) remains outside Performance Phase 1 scope; not changed.

## 9. Screenshots / evidence

- `en-profiles.png`, `en-profiles-detail.png`
- `ar-profiles.png`, `ar-profiles-detail.png`
- `en-coverage.png`, `en-coverage-detail.png`
- `ar-coverage.png`, `ar-coverage-detail.png`
- `en-employee-performance-context.png`
- `ar-employee-performance-context.png`
- `en-employee-performance-unassigned.png`
- `ar-employee-performance-unassigned.png`
- `proof-summary.json`, `proof-summary-2.json`

## 10. Final gate

```text
PRODUCTION_INTERACTIVE_BROWSER_PROOF=PASS
PRODUCTION_BROWSER_EN=PASS
PRODUCTION_BROWSER_AR=PASS
PRODUCTION_BROWSER_RTL=PASS
PRODUCTION_EMPLOYEE_CONTEXT=PASS
PRODUCTION_COVERAGE=PASS
PRODUCTION_UNASSIGNED_BEHAVIOR=PASS
PRODUCTION_CONSOLE_NETWORK=PASS
```
