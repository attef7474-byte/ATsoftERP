# DX-0 Summary — API Module Registry + Frontend Route Alignment

## Status: ACCEPTED

## What Was Done

1. **API Module Registry Audit**: Verified 71 business modules registered in `app.module.ts`. Classified all modules on disk as ACTIVE_REGISTERED, READY_TO_REGISTER, USER_REJECTED_FOR_CURRENT_RELEASE, or LEGACY_UNUSED. No modules were registered or unregistered — only documented.

2. **Frontend API Call Audit**: Scanned all ~100+ frontend API calls across the codebase. Found and fixed **10 critical bugs** where API paths were missing the leading `/`:
   - 9 calls in inventory locks pages (list, detail, create)
   - 1 call in governance-audit page
   - All other API calls use proper leading `/`

3. **Navigation/Sidebar Audit**: Verified all 97 sidebar items point to valid, registered backend modules. No sidebar links point to forbidden or rejected modules.

4. **Alignment Decision Matrix**: Created mapping of every frontend route to its backend module with status (ALIGNED, BUG_FIXED, MONITOR, NO_ACTION_REQUIRED).

## Key Results

| Metric | Value |
|--------|-------|
| Registered business modules | 71 |
| Unregistered but READY_TO_REGISTER | 7 (AccessControl, BOM, Materials, MaterialCategories, Production, Quality, Units) |
| USER_REJECTED modules | 16 |
| LEGACY_UNUSED modules | 12 |
| Frontend API calls scanned | ~100+ |
| API path bugs found + fixed | 10 |
| Navigation links verified | 97 |
| Navigation issues | 0 |
| DB changes | None |
| i18n changes | None |
| Permission changes | None |

## Limitations (Documented)

- 7 modules exist on disk that are READY_TO_REGISTER but not yet registered — they have no frontend dependency yet, so they remain unregistered per Module Activation Policy.
- Reports sidebar section has 22 links whose full API backing should be verified in a future batch (not in DX-0 scope).
- Governance-audit page uses a generic `/inventory/audit` endpoint — confirmed to be served by the Audit module, not a dedicated module.
