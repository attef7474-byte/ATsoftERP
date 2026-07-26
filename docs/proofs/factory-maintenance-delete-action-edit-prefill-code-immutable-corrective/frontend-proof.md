# Frontend Proof

## Summary of Changes

All 16 maintenance frontend pages updated with the following 3 changes:

### 1. Delete Action
- Action bar button with `ActionDeleteIcon` and `variant: 'danger'`
- Enabled only when a row is selected (`enabled: !!selectedId}`)
- Triggered via `useStableHandlers` for stable callback references
- `ConfirmDialog` with danger variant for user confirmation
- Loading state during API call (`saving`)
- API call via `api.delete()` to the correct backend endpoint
- Success toast + list refresh + selected row clear
- Grid action menu also includes delete option

### 2. Edit Prefill (Fetch by ID)
- `openEdit(id: string)` instead of `openEdit(item: Entity)`
- API call to detail endpoint before opening modal
- `loadingDetail` state with spinner display during fetch
- Error handling with toast notification
- Form state populated from fresh API response

### 3. Code Read-Only in Edit
- **Create mode**: Shows italic auto-generated message instead of editable field
- **Edit mode**: Disabled Input with immutable hint text below
- Code excluded from edit save payload via destructuring
- Dedicated edit pages (machines/[id]/edit): code field always disabled

## Pages Modified

1. `production-lines/page.tsx`
2. `operation-types/page.tsx`
3. `cost-centers/page.tsx`
4. `machine-categories/page.tsx`
5. `machine-components/page.tsx`
6. `machine-parts/page.tsx`
7. `spare-parts/page.tsx`
8. `machines/page.tsx` (list page)
9. `machines/[id]/edit/page.tsx` (dedicated edit)
10. `personnel/page.tsx`
11. `machine-responsibilities/page.tsx`
12. `checklist-items/page.tsx`
13. `schedules/page.tsx`
14. `tasks/page.tsx`
15. `downtime-logs/page.tsx`
16. `requests/page.tsx`
