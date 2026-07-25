# Phase 2 — Root Cause Analysis & Phase 3 — Correct Action Model

## Root Cause

**File:** `apps/web/src/components/admin/admin-action-bar.tsx`

The `useRegisterAdminActions` hook used a `serializedRef` to compare action configurations and avoid unnecessary re-registrations. The cleanup effect (`useEffect` with `[]` deps) called `clearActions()` which set `visible=false` and `actions=[]`. However, the serialized comparison prevented re-registration on subsequent mounts because the serialized reference was not reset during cleanup.

In React strict mode (development) or during rapid page navigation:
1. First mount → effect registers actions, `serializedRef.current = serialized`
2. Cleanup (strict mode remount or navigation) → `clearActions()` hides bar, but `serializedRef.current` still holds old value
3. Second mount → effect runs, serialized comparison: old === new → `setActions` and `setVisible` NOT called → actions remain hidden

**Affected component:** `AdminActionBarProvider`, `useRegisterAdminActions`, `AdminShellInner`

**Affected pages:** All factory/maintenance pages using `useRegisterAdminActions`

## Corrected Design

### Fix 1: `useRegisterAdminActions` — Reset serializedRef on cleanup
In the cleanup effect, reset `serializedRef.current = ''` so that on re-mount the comparison always triggers registration.

### Fix 2: `AdminShellInner` — Fallback visibility check
Render the action bar when `actionBarVisible` is true OR when `actions.length > 0`, preventing the bar from disappearing during page transitions.

### Action Separation Model

**Page-level actions** (always visible when permitted):
| Action | Permission | Visible without row |
|--------|-----------|-------------------|
| Add / Create | Create permission | Always |
| Refresh | Read permission | Always |
| Search | Read permission | Always |

**Row-level actions** (require row selection):
| Action | Permission | Visible/Enabled without row |
|--------|-----------|---------------------------|
| Edit | Update permission | Disabled |
| Activate | Update permission | Disabled |
| Deactivate | Update permission | Disabled |
| Start/Complete/Cancel | Update permission | Disabled |
| Delete | Delete permission | Disabled |

### Implementation
1. `admin-action-bar.tsx`: Reset `serializedRef.current = ''` in cleanup effect
2. `admin-shell.tsx`: Use `actionBarVisible || actions.length > 0` for visibility
3. `machine-responsibilities/page.tsx`: Fix `common.add` → `actions.add`
4. All other pages: Already using correct pattern with proper page-level/row-level separation
