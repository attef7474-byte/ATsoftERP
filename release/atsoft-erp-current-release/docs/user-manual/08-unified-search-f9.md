# Unified Search / F9

> User Manual — Section 8

## Purpose

Search across all modules from a single search bar.

## Who Uses This

All users.

## Opening Search

- Press **F9** on your keyboard, or
- Press **Ctrl+K** (Windows) or **Cmd+K** (Mac), or
- Click the search icon in the top bar

## How to Search

1. Open the search modal
2. Type your query
3. Results appear grouped by entity type
4. Click a result to navigate to that record

## Searchable Entities

The search covers all approved modules:
- Products
- Machines
- Warehouses
- Business Partners
- Maintenance Requests
- Users
- Companies
- Branches
- Departments
- And more

## Lookup

The search also supports a **Lookup** mode for finding specific entity types:
1. Open search
2. Use the entity type filter
3. Search narrows to that type

## Expected Result

- Search returns matching records across modules
- Results are grouped and clickable
- Empty results shown when no match found

## Permissions Required

- Search: `search:read`

## Related API Routes

- `GET /api/v1/search/entities`
- `GET /api/v1/search/lookup?q=...`
- `GET /api/v1/search/{entityType}`
