# DataGrid Pages Updated

| Page            | Route                           | Status  |
|----------------|--------------------------------|---------|
| Numbering       | `/admin/settings/numbering`    | Already migrated, used for regression |
| Companies       | `/admin/core/companies`        | Migrated to AdminDataGrid |
| Branches        | `/admin/core/branches`         | Migrated to AdminDataGrid |
| Departments     | `/admin/core/departments`      | Migrated to AdminDataGrid |
| Access Control  | `/admin/access`                | No dedicated page (nav section only) |
| Users           | `/admin/access/users`          | Migrated to AdminDataGrid |
| Roles           | `/admin/access/roles`          | Migrated to AdminDataGrid |
| Permissions     | `/admin/access/permissions`    | Migrated to AdminDataGrid |

## Migration Pattern

Each page was updated from:
- Old: `import { DataTable, Card, ... } from '../../components/admin/ui'`
  + inline action buttons in column render
- New: `import { AdminDataGrid, GridColumn, GridAction } from '../../components/admin/admin-data-grid'`
  + separate `baseColumns` and `gridActions` definitions
  + `dir` prop from `useTranslation()`
  + built-in filter/sort/search/refresh toolbar
  + portal-based actions dropdown

All existing API calls, pagination, search, filters, row selection, CRUD modals,
and confirm dialogs are preserved. No mock data was introduced.
