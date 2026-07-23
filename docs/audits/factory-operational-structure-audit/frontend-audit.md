# Frontend Audit — Pages, Forms, Selectors

> Date: 2026-07-23  
> Scope: `apps/web/src/app/admin/maintenance/`

---

## Existing Pages

| Route | Component | Factory Fields Present? |
|---|---|---|
| `/admin/maintenance/machines` | List + create form | categoryId, companyId, branchId, departmentId — **NO production line, operation type, cost center, tech owner** |
| `/admin/maintenance/machines/new` | Create page | Same selectors as list |
| `/admin/maintenance/machines/[id]` | Detail view | Shows company/branch/department/category — **NO production line, operation type, cost center, tech owner** |
| `/admin/maintenance/machines/[id]/edit` | Edit form | Same selectors as create — **NO factory fields** |
| `/admin/maintenance/machines/[id]/parts` | Parts tab | Per-machine parts list |
| `/admin/maintenance/machine-parts` | Parts grid | Machine + product selectors |
| `/admin/maintenance/requests` | Request list | machineId, type, priority, status filters |
| `/admin/maintenance/requests/new` | Create request | machineId, type, priority, description — **NO costCenterId, operationTypeId** |
| `/admin/maintenance/requests/[id]` | Detail view | Shows machine, type, priority — **NO cost center, operation type, production line** |
| `/admin/maintenance/requests/[id]/edit` | Edit request | Same fields |
| `/admin/maintenance/requests/[id]/cost` | Cost entries | No cost center link |
| `/admin/maintenance/machine-categories` | Categories CRUD | No factory fields needed |

---

## Missing Pages

| Required Page | Purpose |
|---|---|
| `/admin/maintenance/production-lines` | Production line CRUD |
| `/admin/maintenance/operation-types` | Operation type catalog |
| `/admin/maintenance/cost-centers` | Cost center management |
| `/admin/maintenance/machine-components` | Component/assembly tree |
| `/admin/maintenance/spare-parts` | Reusable spare part catalog |
| `/admin/maintenance/spare-parts/[id]` | Spare part detail |
| `/admin/maintenance/machines/[id]/components` | Component tree for a machine |

---

## Machine Edit Form (`edit/page.tsx`)

**Current state (line 19):**
```ts
const [form, setForm] = useState({
  code: '', name: '', categoryId: '', companyId: '', branchId: '',
  departmentId: '', model: '', serialNumber: '', manufacturer: '',
  location: '', notes: ''
});
```

**Missing form fields:**
- `productionLineId: ''`
- `operationTypeId: ''`
- `technicalAdministrationId: ''`
- `technicalDepartmentId: ''`
- `defaultCostCenterId: ''`

**Missing cascading logic (lines 45-48):**
- `setField('companyId')` — resets branchId + departmentId
- `setField('branchId')` — resets departmentId
- **Missing**: `setField('companyId')` should also reset `productionLineId`
- **Missing**: `setField('branchId')` should reset `productionLineId`
- **Missing**: `setField('administrationId')` (on production line / tech owner)
- **Missing**: F9Lookup adapter for `productionLineAdapter`, `operationTypeAdapter`, `costCenterAdapter`

---

## F9Lookup Adapters (line 8 in edit page)
```ts
import {
  F9Lookup, machineCategoryAdapter, companyAdapter,
  branchAdapter, departmentAdapter
} from '../../../../../../components/f9';
```

**Missing adapters needed:**
- `productionLineAdapter`
- `operationTypeAdapter`
- `costCenterAdapter`
- `administrationAdapter` (for tech owner)
- `machineComponentAdapter` (future)

---

## Menu / Navigation

**Missing sidebar menu items:**
- Production Lines
- Operation Types
- Cost Centers
- Machine Components
- Spare Parts

These would need to be added under the Maintenance section in the admin menu configuration.
