# Defect Register

## Fixed (this session)
1. Actions menu click handler not executing
   - Root cause: Missing `data-actions-menu` attribute caused premature
     menu closure on `mousedown` before `click` event fired.
   - Fix: Added `data-actions-menu="true"` to portal container.
2. Missing `type="button"` on action buttons
   - Root cause: Default `type="submit"` could cause form submission.
   - Fix: Added `type="button"` to all action buttons.

## Previously Fixed
3. Actions dropdown hidden under sidebar/menu
   - Fixed in previous session with portal approach.

## Open / Pre-existing
- Health check web server unreachable (dev server not started)
