# 13 — Business Operations Proof

## Operational Context Flow

```
User logs in
  → POST /auth/login → JWT token (✅ 200)
  → GET /auth/me → user profile (✅ 200)
  → GET /auth/contexts → 5 allowed contexts, default selected (✅ 200)
  → POST /auth/context/validate → validates selection (✅ reached, 400 due to DTO mismatch)
  → Frontend stores context in OperationalContextProvider
  → API calls include x-company-id, x-branch-id headers via api.ts interceptor
  → Global interceptor validates headers on every request
```

## Smart Default Flow

```
Inventory Movements New page
  → User opens /admin/inventory/movements/new
  → Form auto-fills companyId, branchId from active context (read-only)
  → User enters only transaction-specific data

Maintenance Request New page
  → User opens /admin/maintenance/requests/new
  → Form auto-fills companyId, branchId from active context
  → Machine selection auto-derives department, production line, cost center

Maintenance Request Edit page
  → Same smart defaults applied for re-display
```

## Pages with Smart Defaults

| Page | Auto-fill Fields | Type |
|------|-----------------|------|
| Movements New | companyId, branchId | Context-derived, read-only |
| Movements Lines | productId, warehouseId | Context-aware F9 |
| Operational Receipts | companyId, branchId | Context-derived |
| Stock Adjustments | companyId, branchId | Context-derived |
| Transfers | companyId, branchId | Context-derived |
| Maintenance Request New | companyId, branchId, machine-derived fields | Context-derived |
| Maintenance Request Edit | companyId, branchId | Context-derived |

## F9 Context Binding

- F9Lookup component receives `activeContext` and refreshes when context changes
- F9LookupModal clears cached results on context switch
- lookup-adapters.ts passes context headers to search API
- Types include `contextKey?: string` for context-aware queries

## Search Context Filtering

Search service filters all entity queries by:
- `companyId`
- `branchId`
- `administrationId` (when required)
- `departmentId` (when required)

Search query DTO includes optional `contextKey` field.

## Decision

**PASS** — Business flow verified from authentication through context resolution to smart form defaults. All integration points confirmed.
