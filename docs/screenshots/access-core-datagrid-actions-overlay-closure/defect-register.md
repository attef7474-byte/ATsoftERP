# Defect Register

## Fixed
1. Actions dropdown hidden under sidebar/menu
   - Root cause: stacking context trapped inside `.admin-main` (z-index: 40)
   - Fix: portal to `document.body` with z-index: 100

2. GridAction.enabled only supported static boolean
   - Root cause: `enabled` prop typed as `boolean | undefined`
   - Fix: changed to `boolean | ((item: T) => boolean)`

3. Overflow clipping of dropdown
   - Root cause: `overflow: hidden` on grid container
   - Fix: removed `overflow: hidden` class

## Open / Pre-existing (not addressed)
1. Health check web unreachable (dev server not started in CI)
2. Smoke check login API fails (test credentials mismatch with validation rules)
