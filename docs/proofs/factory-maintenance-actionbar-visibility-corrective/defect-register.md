# Defect Register

## Open Defects

| ID | Severity | Description | Status | Notes |
|----|----------|-------------|--------|-------|
| — | — | No open blocking defects | — | All requirements satisfied |

## Fixed Defects

| ID | Severity | Description | Fix | Verification |
|----|----------|-------------|-----|-------------|
| D-001 | BLOCKER | Action bar hidden when no row selected on page load | Reset `serializedRef.current = ''` in cleanup; shell fallback `actionBarVisible || actions.length > 0` | Build/typecheck pass |
| D-002 | LOW | `common.add` used instead of `actions.add` in Machine Responsibilities | Changed to `actions.add` | i18n check pass |

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Backup Spare Parts page does not exist | Not accessible | No route or sidebar entry — N/A |
| Accountability page (KPI dashboard) has no action bar | Dashboard read-only page | Intended design, not a CRUD grid |
