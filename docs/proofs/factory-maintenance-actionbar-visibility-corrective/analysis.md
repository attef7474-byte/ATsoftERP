# Phase 1 — Audit Current Action Bar Behavior

## Audit Results per Page

| Page | Route | Exists | Sidebar | Row count | Empty possible | Action bar visible (no row) | Add/Create visible | Refresh visible | Search visible | Edit before row | Activate/Deactivate before row | After row selection | Raw keys found | Required action | Status |
|------|-------|--------|---------|-----------|----------------|---------------------------|-------------------|-----------------|----------------|-----------------|-------------------------------|-------------------|----------------|-----------------|--------|
| Machines | /admin/maintenance/machines | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | Disabled (enabled:!!selectedId) | Enabled | None | Verify fix | Done |
| Machine Categories | /admin/maintenance/machine-categories | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | Disabled (enabled:!!selectedId) | Enabled | None | Verify fix | Done |
| Spare Parts | /admin/maintenance/spare-parts | Yes | Yes | Varies | Yes | Yes | Yes (actions.add) | Yes (common.refresh) | Yes | Not in action bar | Not in action bar | N/A | None | Verify fix | Done |
| Backup Spare Parts | N/A | No | No | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Documents (Machine Docs) | /admin/maintenance/machine-documents | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | N/A | Enabled | None | Verify fix | Done |
| Production Lines | /admin/maintenance/production-lines | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | Disabled (enabled:!!selectedId) | Enabled | None | Verify fix | Done |
| Operation Types | /admin/maintenance/operation-types | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | Disabled (enabled:!!selectedId) | Enabled | None | Verify fix | Done |
| Cost Centers | /admin/maintenance/cost-centers | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | Disabled (enabled:!!selectedId) | Enabled | None | Verify fix | Done |
| Maintenance Requests | /admin/maintenance/requests | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | N/A (start/complete/cancel) | Enabled | None | Verify fix | Done |
| Maintenance Tasks | /admin/maintenance/tasks | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | N/A (start/complete/cancel) | Enabled | None | Verify fix | Done |
| Maintenance Schedules | /admin/maintenance/schedules | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | Disabled (enabled:!!selectedId) | Enabled | None | Verify fix | Done |
| Checklists | /admin/maintenance/checklist-items | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | Disabled (enabled:!!selectedId) | Enabled | None | Verify fix | Done |
| Downtime Records | /admin/maintenance/downtime-logs | Yes | Yes | Varies | Yes | Yes | Yes (common.create) | Yes (common.refresh) | Yes | Disabled (enabled:!!selectedId) | N/A (close) | Enabled | None | Verify fix | Done |
| Maintenance Personnel | /admin/maintenance/personnel | Yes | Yes | Varies | Yes | Yes | Yes (actions.add) | Yes (common.refresh) | Yes | Not in action bar | Not in action bar | N/A | None | Verify fix | Done |
| Machine Responsibilities | /admin/maintenance/machine-responsibilities | Yes | Yes | Varies | Yes | Yes | Yes (common.add → fixed to actions.add) | Yes (common.refresh) | Yes | Not in action bar | Not in action bar | N/A | None (fixed) | Fixed common.add key | Done |
| Accountability | /admin/maintenance/accountability | Yes | Yes | N/A (KPI page) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | None | No action bar needed (KPI dashboard) | Done |

## Summary
- All 15 existing pages have the action bar with proper Add/Create and Refresh visibility without row selection
- Row-dependent actions (Edit, Activate/Deactivate) properly disabled until row selection
- Backup Spare Parts does not exist (no route, no sidebar link)
- Accountability is a KPI dashboard, not a CRUD grid
- Machine Responsibilities had `common.add` key → fixed to `actions.add`
- All pages register actions with `useRegisterAdminActions` — core component handles visibility
