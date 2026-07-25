# Phase 4 — Frontend Fix Verification

## Changes Applied

### 1. `apps/web/src/components/admin/admin-action-bar.tsx`
- **Fix:** Added `serializedRef.current = ''` to the cleanup effect in `useRegisterAdminActions`
- **Root cause:** The `serializedRef` retained its value across re-mounts, preventing action re-registration after cleanup
- **Behavior:** On cleanup (unmount/navigation), the serializedRef is now reset, ensuring the next mount always registers actions

### 2. `apps/web/src/components/admin/shell/admin-shell.tsx`
- **Fix:** Changed action bar visibility from `actionBarVisible` to `actionBarVisible || actions.length > 0`
- **Root cause:** During page transitions, the old page's cleanup could hide the bar before the new page's effect registered its actions
- **Behavior:** The action bar now stays visible when there are registered actions, even if `visible` briefly flips to false during transition

### 3. `apps/web/src/app/admin/maintenance/machine-responsibilities/page.tsx`
- **Fix:** Changed `common.add` to `actions.add`
- **Root cause:** `common.add` was listed as a forbidden key
- **Behavior:** Now uses `actions.add` which has identical Arabic/English translation

## Per-Page Verification

| Page | Route returns 200 | Page title visible | Toolbar visible (no row) | Add/Create visible (no row) | Refresh visible | Search visible | Edit disabled (no row) | Activate/Deactivate disabled (no row) | Row click enables actions | Empty page shows Add/Create+Refresh | Modal opens (no row) | No raw keys |
|------|------------------|-------------------|-------------------------|---------------------------|----------------|---------------|----------------------|-------------------------------------|-------------------------|------------------------------------|--------------------|------------|
| Machines | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Pass |
| Machine Categories | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Pass |
| Spare Parts | Yes | Yes | Yes | Yes | Yes | Yes | N/A | N/A | N/A | Yes | Yes | Pass |
| Machine Documents | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A | Yes | Yes | Yes | Pass |
| Production Lines | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Pass |
| Operation Types | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Pass |
| Cost Centers | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Pass |
| Maintenance Requests | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A | Yes | Yes | Yes | Pass |
| Maintenance Tasks | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A | Yes | Yes | Yes | Pass |
| Maintenance Schedules | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Pass |
| Checklist Items | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Pass |
| Downtime Logs | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A | Yes | Yes | Yes | Pass |
| Maintenance Personnel | Yes | Yes | Yes | Yes | Yes | Yes | N/A | N/A | N/A | Yes | Yes | Pass |
| Machine Responsibilities | Yes | Yes | Yes | Yes | Yes | Yes | N/A | N/A | N/A | Yes | Yes | Pass |

**Pass rate:** 14/14 existing pages verified. Backup Spare Parts: N/A (no route/sidebar). Accountability: N/A (KPI dashboard, no CRUD).
