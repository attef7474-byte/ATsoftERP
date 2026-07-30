# Validation Error Toast Corrective — Summary

**Batch**: v10 — Validation error toast removal  
**Date**: 2026-07-30  
**Previous commit**: `612caed` (v9 sidebar corrective + Global Error Dialog)  
**Build**: ✅ PASS (166 pages, zero errors)  
**Status**: ✅ ACCEPTED

## Scope

Remove ALL remaining client-side validation guard toasts (`if.*showToast.*error`) and replace with inline field validation errors.

**Policy enforced**:
- Required-field validation errors → inline near the field (NOT toast)
- API/operation errors → `handleApiError(err)` → Global Error Dialog (NOT toast)
- Only success/info messages → `showToast(.., 'success'/'info')` allowed

## What was fixed

- **Core pages (4)**: `companies`, `branches`, `administrations`, `departments` — `useCrudList` `onError` callbacks changed from `showToast(message, 'error')` to `setValidationErrors({ form: message })`
- **Inventory pages (14)**: locations, product-categories, products, products/[id], warehouses, physical-counts/new, adjustments, movements, opening-balances, operational-receipts, stock-adjustments, transfers, counts, counts/[id]/execute
- **Inventory sub-pages (2)**: movements/[id]/lines, adjustments/[id]/lines
- **Core detail pages (4)**: companies/[id], branches/[id], administrations/[id], departments/[id]
- **Maintenance pages (26)**: machines, machines/[id], machine-categories, machine-components, machine-components/[id], machine-documents, machine-parts, machine-parts/[id]/machines, machine-responsibilities, operation-types, personnel, production-lines, cost-centers, requests, requests/[id], requests/[id]/assign, requests/[id]/cost, requests/[id]/parts, requests/[id]/checklist, tasks, tasks/[id]/assign, schedules, downtime-logs, spare-parts, spare-parts/[id]/edit, checklist-items
- **Access pages (3)**: users, users/[id], roles
- **Barcode pages (3)**: generate, machine-cards/designer, product-labels/designer
- **Other pages (4)**: messaging, profile/password, documents/attachments/upload, CountLinesPanel

**Total: ~60 files modified, ~53 unique files with validation guard toasts migrated**

## Key patterns applied

1. Added `validationErrors` state: `const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});`
2. Replaced `if (!field) { showToast(t('validation.required'), 'error'); return; }` with inline validation:
   - Build `errs` object → `setValidationErrors(errs)` → early return
   - No toast, no API call when validation fails
3. In JSX: `{validationErrors.fieldName && <p className="text-red-500 text-sm mt-1">{validationErrors.fieldName}</p>}`
4. Cleared validation errors on: input change, modal open, modal close
5. Kept all success/info toasts and `handleApiError` calls intact

## Proof

- `01-api-proof.md`: N/A (frontend-only changes)
- `02-build-proof.md`: Build PASS
- `03-validation-scan-proof.md`: Zero validation guard toasts in codebase
- `04-final-acceptance-report.md`: Full report
