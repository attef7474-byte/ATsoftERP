# Corrective Scope — v9 Sidebar + Global Error Dialog

## Motivation

The v9 sidebar redesign (commit `95e6471`) was accepted with known limitations:
1. No CSS transitions on accordion (groups snap open/closed)
2. Operational errors shown as fleeting toasts (user must catch them before they disappear)
3. Mobile menu accordion not synced with desktop
4. No centralized API error dialog

This batch corrects all critical issues and standardizes error handling.

## Scope

### In Scope
- Sidebar accordion height/opacity CSS transition
- Global Error Dialog (ErrorModalProvider + useApiErrorHandler + normalizeApiError)
- Operational error toast → global dialog replacement (~60+ files)
- New `errorDialog` i18n namespace (12 keys × EN + AR)
- `AGENTS.md` prevention rules for sidebar + error handling

### Out of Scope
- Sidebar group/section/item restructuring
- Route changes
- Permission changes
- DB/schema changes
- Mobile menu sync (documented limitation)
- CSS animation refinement beyond basic transition
- Invalidating previous acceptance

## Files Changed

| Category | Count |
|----------|-------|
| New infrastructure files | 4 |
| Modified page files | ~65 |
| i18n files | 2 new + 3 modified |
| Config/docs | 2 |
| Total | ~75 files (+349/-168) |
