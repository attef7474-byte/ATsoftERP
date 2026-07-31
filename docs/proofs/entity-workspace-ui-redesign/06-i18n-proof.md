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

## Corrective phase additions — `maintenance` namespace

| Key | EN | AR |
|-----|----|----|
| `maintenance.linkedInventoryItem` | Linked Inventory Item | الصنف المخزني المرتبط |
| `maintenance.linkedInventoryItemHint` | The inventory item this spare part maps to (shown read-only) | الصنف المخزني الذي يرتبط به هذا الجزء (يظهر للقراءة فقط) |

Applied to 4 usages in Machine Parts form/detail pages.

## Final i18n state

- EN total: 2,977 (v10) + 11 (`workspace`) + 2 (`maintenance`) = **2,990 keys**
- AR total: 2,977 (v10) + 11 (`workspace`) + 2 (`maintenance`) = **2,990 keys**
- Match: **100%** (verified by parity sweep script)
- AR files valid UTF-8 (console `????` artifacts were PowerShell display encoding only — file bytes verified)

## Balanced check (all namespaces)

All 11 `workspace` keys and both new `maintenance` keys exist in EN and AR — 100% balance.
