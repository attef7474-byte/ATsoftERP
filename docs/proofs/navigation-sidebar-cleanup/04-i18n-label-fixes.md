# 04 — i18n Label Fixes

## Files Changed

| File | Type of Changes |
|------|----------------|
| `apps/web/src/lib/i18n/locales/en/navigation.ts` | 25 label values changed |
| `apps/web/src/lib/i18n/locales/ar/navigation.ts` | 26 label values changed |

## English Changes (`en/navigation.ts`)

```
inventoryAdjustments:      'Inventory Adjustments'      → 'Inventory Count Adjustments'
maintenanceAccountability: 'Accountability'              → 'Maintenance Responsibilities'
generate:                  'Generate'                    → 'Create Barcode / QR'
print:                     'Print'                       → 'Print Barcode'
scan:                      'Scan'                        → 'Scan Barcode'
preview:                   'Preview'                     → 'Barcode Preview'
records:                   'Records'                     → 'Barcode Records'
templates:                 'Templates'                   → 'Barcode Templates'
notificationsReport:       'Notifications'               → 'Notifications Report'
attachmentsReport:         'Attachments'                 → 'Attachments Report'
auditTrailReport:          'Audit Trail'                 → 'Audit Trail Report'
userActivityReport:        'User Activity'               → 'User Activity Report'
assetsReport:              'Assets Register'             → 'Assets Report'
partsReport:               'Parts Inventory'             → 'Parts Inventory Report'
partnersReport:            'Business Partners'           → 'Partners Report'
machineLogReport:          'Machine Log'                 → 'Machine Log Report'
partsUsageReport:          'Parts Usage'                 → 'Parts Usage Report'
upcomingPreventiveReport:  'Upcoming Preventive'         → 'Upcoming Preventive Report'
overduePreventiveReport:   'Overdue Preventive'          → 'Overdue Preventive Report'
lowStockReport:            'Low Stock'                   → 'Low Stock Report'
```

## Arabic Changes (`ar/navigation.ts`)

```
inventoryAdjustments:      'تسويات المخزون'              → 'تسويات الجرد'
machineParts:              'قطع الغيار'                  → 'قطع الماكينات'
maintenanceAccountability: 'المسؤوليات'                  → 'مسؤوليات الصيانة'
generate:                  'إنشاء'                        → 'إنشاء باركود'
print:                     'طباعة'                        → 'طباعة الباركود'
scan:                      'مسح'                          → 'مسح الباركود'
preview:                   'معاينة'                       → 'معاينة الباركود'
records:                   'السجلات'                      → 'سجلات الباركود'
templates:                 'القوالب'                      → 'قوالب الباركود'
notificationsReport:       'الإشعارات'                    → 'تقرير الإشعارات'
attachmentsReport:         'المرفقات'                     → 'تقرير المرفقات'
auditTrailReport:          'سجل التدقيق'                  → 'تقرير سجل التدقيق'
userActivityReport:        'نشاط المستخدمين'              → 'تقرير نشاط المستخدمين'
assetsReport:              'سجل الأصول'                   → 'تقرير الأصول'
partsReport:               'مخزون قطع الغيار'            → 'تقرير مخزون قطع الغيار'
partnersReport:            'شركاء الأعمال'               → 'تقرير شركاء الأعمال'
machineLogReport:          'سجل الآلة'                    → 'تقرير سجل الآلة'
partsUsageReport:          'استخدام القطع'               → 'تقرير استخدام القطع'
upcomingPreventiveReport:  'الصيانة الوقائية القادمة'    → 'تقرير الصيانة الوقائية القادمة'
overduePreventiveReport:   'الصيانة الوقائية المتأخرة'   → 'تقرير الصيانة الوقائية المتأخرة'
lowStockReport:            'مخزون منخفض'                 → 'تقرير المخزون المنخفض'
```

## i18n Parity Verification

| Check | Result |
|-------|--------|
| EN key count | 116 |
| AR key count | 116 |
| Keys match between EN/AR | ✅ 100% |
| All nav-data keys exist in i18n | ✅ Verified |
| No orphan keys | ✅ |
| Cross-namespace reference (barcodes.overview.title) | Unchanged (pre-existing) |

## Key Principles Applied

1. **Report = تقرير**: Every item under the Reports group now has "Report" in English or "تقرير" in Arabic, except:
   - "Reports Home" (group home page, not a report)
   - "Maintenance Overview" / "Inventory Overview" (overview pages, not classic reports)
   - "Parts Inventory Report" uses "Inventory" as qualifier

2. **No raw keys exposed**: All labels use `t('navigation.xxx')` pattern. No hardcoded strings.

3. **Distinct AR labels**: All pairs that previously had identical AR labels are now differentiated.
