# Data Preservation Proof

## Migration

| Property | Value |
|----------|-------|
| Migration file | `20260723023622_add_administration` |
| Applied | Yes |
| Administration table exists | Yes |
| Department has administrationId | Yes |

## Counts

| Entity | Count |
|--------|-------|
| Companies | 5 |
| Branches | 3 |
| Administrations | 1 |
| Departments | 3 |
| Departments with administrationId | 3 |
| Departments without administrationId | 0 |

## Default Administrations

| ID | Code | Name | Branch |
|----|------|------|--------|
| A01EDD48-97A4-42D1-AF60-7075B012AFEC | HQ_GEN | General Administration | Main/Headquarter branch |

## Existing Data Integrity

All 3 existing departments have been linked to the default administration. No data loss occurred.

## Verification Command

```sql
SELECT COUNT(*) AS company_count FROM companies WHERE deletedAt IS NULL;  -- 5
SELECT COUNT(*) AS branch_count FROM branches WHERE deletedAt IS NULL;    -- 3
SELECT COUNT(*) AS administration_count FROM administrations;             -- 1
SELECT COUNT(*) AS department_count FROM departments WHERE deletedAt IS NULL; -- 3
SELECT COUNT(*) AS depts_with_admin FROM departments WHERE administrationId IS NOT NULL AND deletedAt IS NULL;    -- 3
SELECT COUNT(*) AS depts_without_admin FROM departments WHERE administrationId IS NULL AND deletedAt IS NULL; -- 0
```
