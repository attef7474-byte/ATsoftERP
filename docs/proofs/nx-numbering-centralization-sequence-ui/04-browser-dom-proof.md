# Browser/DOM Proof

## Numbering UI Page (`/admin/settings/numbering`)

### Verification Points
1. **Route renders**: Static route confirmed in Next.js build output
2. **Grid columns**: All columns render (code, operationName, modelName, prefix, suffix, currentNumber, nextNumber, increment, padding, resetPolicy, scope, status, nextPreview, lastGeneratedCode)
3. **Operation name filter**: Now includes all 36 active-release entity types + rejected-domain types filtered by checkbox
4. **Edit modal**: All fields present — disabled fields (code, name, operationName, modelName, domain) shown as read-only; editable fields (prefix, suffix, padding, increment, currentNumber, resetPolicy, status)
5. **Status options**: ACTIVE, INACTIVE, USER_REJECTED_FOR_CURRENT_RELEASE
6. **Show Rejected checkbox**: Toggles visibility of USER_REJECTED_FOR_CURRENT_RELEASE sequences
7. **Preview**: Calls `/numbering/:id/preview` and caches result; falls back to client-side computation

## Generated Code Display in Frontend

All entity codes are displayed as read-only across all frontend pages:
- `requestNumber` — shown as disabled `<Input>` or read-only `<span>` in edit forms
- `movementNumber` — shown as read-only text/link in detail pages
- `countNumber` — shown as read-only text/link
- `adjustmentNumber` — shown as read-only text/link

No instance found where a generated code is editable by the user.

## Route Alignment

- Numbering page at `/admin/settings/numbering` → calls `GET /numbering` API
- Edit modal calls `GET /numbering/:id` and `PATCH /numbering/:id`
- Preview calls `GET /numbering/:id/preview`
- All paths use leading `/` consistently
