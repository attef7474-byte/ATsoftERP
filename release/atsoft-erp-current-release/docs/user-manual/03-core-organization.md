# Core Organization

> User Manual — Section 3 — Companies, Branches, Departments

## Purpose

Manage the organizational structure: companies, branches, and departments.

## Who Uses This

Administrators.

## Companies

### View Companies

1. Navigate to **Companies** from the sidebar
2. The list shows all registered companies

### Fields

- Name
- Code
- Tax ID
- Contact info
- Status (Active/Inactive)

## Branches

### View Branches

1. Navigate to **Branches** from the sidebar
2. The list shows all branches, usually under a company

### Fields

- Name
- Code
- Company (parent)
- Address
- Status

## Departments

### View Departments

1. Navigate to **Departments** from the sidebar
2. The list shows all departments in a tree structure

### Tree View

Click **Tree** to see the department hierarchy (parent → child).

### Fields

- Name
- Code
- Parent department
- Status

## Expected Result

- Lists show existing records
- Tree view shows hierarchical relationships
- Empty state shown when no records exist

## Permissions Required

- Companies: `companies:read`
- Branches: `branches:read`
- Departments: `departments:read`

## Related API Routes

- `GET /api/v1/companies`
- `GET /api/v1/branches`
- `GET /api/v1/departments`
- `GET /api/v1/departments/tree`
