# Page Actions Matrix

| Page         | Route                     | View | Edit | Delete | Activate | Deactivate | Permissions |
|-------------|---------------------------|------|------|--------|----------|------------|-------------|
| Companies    | /admin/core/companies     | ✓    | ✓    | ✓      | ✓        | ✓          | —           |
| Branches     | /admin/core/branches      | ✓    | ✓    | —      | ✓        | ✓          | —           |
| Departments  | /admin/core/departments   | ✓    | ✓    | —      | ✓        | ✓          | —           |
| Users        | /admin/access/users       | ✓    | ✓    | —      | ✓        | ✓          | —           |
| Roles        | /admin/access/roles       | ✓    | ✓*   | —      | ✓        | ✓*         | ✓           |
| Permissions  | /admin/access/permissions | —    | —    | —      | —        | —          | ✓ (matrix)  |
| Numbering    | /admin/settings/numbering | ✓    | ✓    | —      | —        | —          | —           |

*Roles: Edit and Deactivate disabled (`enabled: (r) => !r.isSystem`) for system roles.

Each action opens the correct view:
- View: navigates to detail page via `router.push`
- Edit: opens edit modal (Companies, Branches, Departments, Users, Numbering) or navigates to edit page (Roles)
- Delete: shows confirm dialog, then calls DELETE API
- Activate/Deactivate: shows confirm dialog, then calls PATCH status API
- Permissions: navigates to role permissions management page
