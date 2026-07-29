# 07 — Recommended Future Cleanup Plan

## Priority Ranking

| Pri | Item | Effort | Risk | Category |
|-----|------|--------|------|----------|
| P0 | Fix `notificationsReport` and `attachmentsReport` i18n values | 5 min | None | i18n defect |
| P0 | Differentiate `auditTrailReport` AR from `auditLog` AR | 5 min | None | i18n defect |
| P0 | Differentiate `userActivityReport` EN from `userActivity` EN | 5 min | None | i18n defect |
| P0 | Differentiate `stockAdjustments` AR from `inventoryAdjustments` AR | 5 min | None | i18n defect |
| P1 | Resolve Inventory Adjustments vs Stock Adjustments duplicate | 1-2 days | Medium | ACCIDENTAL duplicate |
| P1 | Rename/restructure "Notifications Report" i18n value (EN + AR) | 5 min | None | EXACT_LABEL |
| P1 | Rename/restructure "Attachments Report" i18n value (EN + AR) | 5 min | None | EXACT_LABEL |
| P1 | Rename "User Activity Report" (EN) | 5 min | None | EXACT_LABEL |
| P2 | Move installed-parts route to `/admin/maintenance/installed-parts` | 2-3 hrs | Low | Path consistency |
| P2 | Move spare-part-conditions route to `/admin/maintenance/spare-part-conditions` | 2-3 hrs | Low | Path consistency |
| P2 | Add role-based nav filtering to sidebar.tsx | 2-3 days | Medium | UX improvement |
| P2 | Create Maintenance Setup sub-group for categories, types, cost centers | 1-2 hrs | Low | Group organization |
| P3 | Fix Alerts icon (uses `dashboard` instead of dedicated icon) | 30 min | None | Icon defect |
| P3 | Normalize barcode overview to use `navigation.*` key | 30 min | Low | Consistency |
| P3 | Consider sub-grouping within Reports (25 items) | 1 day | Low | Usability |
| P3 | Consider merging Documents group if it stays at 1 child | 30 min | Low | Group organization |
| P4 | Add tooltip/description to Movements vs Ledger items | 1 hr | Low | User guidance |
| P4 | Add AR differentiation for Machine Parts vs Spare Parts | 30 min | Low | NAMING_AMBIGUITY |

## P0 Quick Fixes (immediate)

These are pure i18n value changes in `en/navigation.ts` and `ar/navigation.ts` — no code structure changes:

```typescript
// en/navigation.ts
notificationsReport: 'Notifications Report',     // was 'Notifications'
attachmentsReport: 'Attachments Report',          // was 'Attachments'
userActivityReport: 'User Activity Report',       // was 'User Activity' (or keep as-is and rename sys one)
auditTrailReport: 'Audit Trail Report',           // optional (currently distinct from 'Audit Log')

// ar/navigation.ts
notificationsReport: 'تقرير الإشعارات',           // was 'الإشعارات'
attachmentsReport: 'تقرير المرفقات',              // was 'المرفقات'
auditTrailReport: 'تقرير سجل التدقيق',            // was 'سجل التدقيق' (differentiate from sys audit)
stockAdjustments: 'تصحيح المخزون',                // was 'تسويات المخزون' (differentiate from inventoryAdjustments)
```

## D1 Resolution Strategy (Inventory Adjustments vs Stock Adjustments)

This is the most architecturally complex issue. Options:

**Option A (Recommended)**: Keep both but clearly differentiate names/descriptions
- Rename: "Hand Adjustments" vs "System Adjustments"
- Or: "Simple Adjustments" vs "Batch Adjustments"
- Add tooltips explaining when to use each

**Option B (Cleanest)**: Merge into one unified Adjustment page with tabs/modes
- Single sidebar entry
- Two operational modes (simple/batch) accessible via tabs
- Eliminates user confusion entirely

**Option C (Minimal)**: Only fix the AR label to differentiate, keep both entries
- Least user benefit but minimal effort

## Architectural Considerations for Cleanup

1. **Permission-based visibility**: After P0, the most impactful improvement is integrating permission checks into `sidebar.tsx` so users only see nav items they can access.

2. **Group restructuring**: Reports (25 items) and Maintenance (25 items) are very large. Consider sub-group headers or visual separators.

3. **Path normalization**: Two maintenance items at `/admin/` root should move under `/admin/maintenance/` for consistency. Requires route redirect or file move.

4. **Documents group**: With only 1 child, the Documents group header is redundant. Either add more document-related items or flatten it.
