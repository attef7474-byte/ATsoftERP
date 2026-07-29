# Implementation Map — Final Readiness Corrective Patch

**Date**: 2026-07-29

---

## Files Created (8 new page.tsx files)

| # | File Path | Purpose | Module/Batch |
|---|-----------|---------|-------------|
| 1 | `apps/web/src/app/admin/maintenance/bom/page.tsx` | BOM list page | AH-AI |
| 2 | `apps/web/src/app/admin/maintenance/spare-part-plans/page.tsx` | Spare Part Plans list page | AH-AI |
| 3 | `apps/web/src/app/admin/maintenance/repair-orders/page.tsx` | Repair Orders list page | AD-AE |
| 4 | `apps/web/src/app/admin/installed-parts/page.tsx` | Installed Parts register page | AB-AC |
| 5 | `apps/web/src/app/admin/spare-part-conditions/page.tsx` | Spare Part Conditions balance page | Z-AA |
| 6 | `apps/web/src/app/admin/maintenance/reliability/mttr/page.tsx` | Reliability MTTR KPI page | AF-AG |
| 7 | `apps/web/src/app/admin/maintenance/sla/page.tsx` | SLA management page | Built-in |
| 8 | `apps/web/src/app/admin/reports/page.tsx` | Reports hub index page | Built-in |

---

## Files Modified (6 files, +32 lines total)

### Navigation Config

| File | Change | Lines |
|------|--------|-------|
| `apps/web/src/components/admin/shell/navigation-data.ts` | Added 7 maintenance sub-menu links + 1 reports home link | +8 |

### i18n — English

| File | Keys Added | Lines |
|------|-----------|-------|
| `apps/web/src/lib/i18n/locales/en/navigation.ts` | `bom`, `sparePartPlans`, `repairOrders`, `installedParts`, `sparePartConditions`, `mttr`, `sla`, `reportsHome` | +8 |
| `apps/web/src/lib/i18n/locales/en/common.ts` | `last7Days`, `last30Days`, `last90Days`, `lastYear` | +4 |

### i18n — Arabic

| File | Keys Added | Lines |
|------|-----------|-------|
| `apps/web/src/lib/i18n/locales/ar/navigation.ts` | `bom` (قائمة المواد), `sparePartPlans` (خطط قطع الغيار), `repairOrders` (أوامر الإصلاح), `installedParts` (القطع المثبتة), `sparePartConditions` (حالات قطع الغيار), `mttr` (متوسط وقت الإصلاح), `sla` (مستوى الخدمة), `reportsHome` (الصفحة الرئيسية للتقارير) | +8 |
| `apps/web/src/lib/i18n/locales/ar/common.ts` | `last7Days` (آخر 7 أيام), `last30Days` (آخر 30 يوم), `last90Days` (آخر 90 يوم), `lastYear` (السنة الماضية) | +4 |

---

## Files Not Modified (verified no change needed)

| File | Reason |
|------|--------|
| `apps/api/src/app.module.ts` | Already registered — BOM, SparePartPlans, RepairOrders, InstalledPartsReplacement modules all active |
| `apps/api/prisma/schema.prisma` | No schema change needed |
| Any permission/audit files | No permission changes needed |
| Any backend service/controller files | All 6 of 8 required endpoints already working; SLA and Reports backend not in scope |
