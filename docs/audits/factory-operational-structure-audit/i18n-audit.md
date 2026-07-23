# i18n Audit — Translation Keys

> Date: 2026-07-23  
> Scope: `apps/web/src/lib/i18n/locales/en/maintenance.ts`

---

## Current i18n Coverage

All existing maintenance modules (machines, categories, parts, requests, tasks, schedules, downtime logs) have translation keys.

## Missing Translation Keys

**No keys exist for any of these terms:**
- `productionLine` / `production-line` / `productionLines`
- `operationType` / `operation-type` / `operationTypes`
- `costCenter` / `cost-center` / `costCenters`
- `machineComponent` / `machine-component` / `machineComponents`
- `sparePart` / `spare-part` / `spareParts`
- `componentSparePart` / `component-spare-part`
- `technicalAdministration` / `technicalDepartment`
- `defaultCostCenter`

**Verification method:**
```
Select-String -Pattern "productionLine|operationType|costCenter|machineComponent|sparePart|technicalAdmin|technicalDept"
```
→ **Zero results** across all i18n locale files.

---

## Impact

- All new factory entity pages will need complete i18n key definitions
- Existing machine and request forms will need new keys for added fields
- Arabic locale (`ar/maintenance.ts`) must mirror all English additions
