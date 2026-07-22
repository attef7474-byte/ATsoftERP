# Affected Pages

## Inline Edit Modals (added detail fetch)

| Page | Path | Form Fields |
|------|------|-------------|
| Companies | `admin/core/companies/page.tsx` | name, legalName, taxNumber, phone, email, address |
| Branches | `admin/core/branches/page.tsx` | companyId, name, address, phone |
| Departments | `admin/core/departments/page.tsx` | companyId, branchId, parentId, name |
| Users | `admin/access/users/page.tsx` | email, password, name, phone, companyId, branchId, departmentId, roleId |
| Numbering | `admin/settings/numbering/page.tsx` | prefix, suffix, padding, increment, currentNumber, resetPolicy, status |
| Notification Rules | `admin/settings/notification-rules/page.tsx` | code, nameAr, nameEn, description, eventType, channel, severity, enabled |
| Warehouses (list) | `admin/inventory/warehouses/page.tsx` | companyId, branchId, name, location |

## Separate Edit Pages (fixed response access)

| Page | Path | Form Fields |
|------|------|-------------|
| Roles | `admin/access/roles/[id]/edit/page.tsx` | code, name, description |
| Warehouses (detail) | `admin/inventory/warehouses/[id]/edit/page.tsx` | companyId, branchId, code, name, location |
| Locations | `admin/inventory/locations/[id]/edit/page.tsx` | warehouseId, code, name, barcode |
| Movements | `admin/inventory/movements/[id]/edit/page.tsx` | notes |
| Adjustments | `admin/inventory/adjustments/[id]/edit/page.tsx` | reason, notes |
| Product Categories | `admin/inventory/product-categories/[id]/edit/page.tsx` | code, name, description, parentId |

## Already Correct (no changes needed)

Products, Machines, Maintenance Requests, Maintenance Tasks,
Inventory Counts, Machine Parts, Machine Documents,
Machine Categories, Downtime Logs
