# i18n Proof

## New namespace: `workspace`

A new `workspace` namespace was created with 11 keys in both EN and AR.

### Key list

| Key | EN | AR |
|-----|----|----|
| `workspace.overview` | Overview | نظرة عامة |
| `workspace.branches` | Branches | الفروع |
| `workspace.departments` | Departments | الأقسام |
| `workspace.users` | Users | المستخدمون |
| `workspace.warehouses` | Warehouses | المستودعات |
| `workspace.roles` | Roles | الأدوار |
| `workspace.operationalScopes` | Operational Scopes | النطاقات التشغيلية |
| `workspace.locations` | Locations | المواقع |
| `workspace.balanceSummary` | Balance Summary | ملخص الأرصدة |
| `workspace.noRecords` | No records found | لا توجد سجلات |
| `workspace.details` | Details | التفاصيل |

## Registration

- `en/index.ts`: imports and spreads `workspace` via `...workspace`
- `ar/index.ts`: imports and spreads `workspace` via `...workspace`
- `TranslationNamespace` type: `'workspace'` already exists in union (from v10)

## Balanced check

All 11 keys exist in both `en/workspace.ts` and `ar/workspace.ts` — 100% balance.

## Usage in pages

All 5 modified pages use `t('workspace.overview')`, `t('workspace.branches')`, etc. for drawer section labels and nav items. No raw English/Arabic strings.

## Pre-existing i18n status

- 12 existing namespaces: unchanged
- Total EN keys: 2,977 + 11 = **2,988**
- Total AR keys: 2,977 + 11 = **2,988**
- Match: **100%**
