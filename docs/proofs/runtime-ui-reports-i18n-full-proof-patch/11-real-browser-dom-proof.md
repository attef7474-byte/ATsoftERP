# 11 — Real Browser DOM Proof

## Result

- Browser: **Chrome extension**, real authenticated local session.
- Routes: **36/36 PASS**.
- DOM assertions: **360/360 PASS**.
- Post-restart console errors/warnings: **0**.
- Required screenshot routes: **21/21 PASS**; all other modified report routes were also tested.
- No screenshots were taken, per repository rule. Evidence used live DOM, visible text, URL, loading state, runtime-error patterns, raw-key patterns, enum patterns, direction and console logs.
- SLA calendar sample confirmed Arabic values: `تقويم الصيانة البدء المخطط الانتهاء المخطط القوى العاملة الكل Unique Test No User 1 No User 2 Debug Dup 584721662 الماكينة الكل ماكينة تغليف10019 ماكينة ميازيين غلافة 10019 النوع الكل وقائية تصحيحية طارئة تنبؤية معايرة الحالة الكل مفتوح قيد التنفيذ مكتمل ملغي مغلق الأولوية الكل منخفضة متوسطة عالية حرجة حالة مستوى الخدمة الكل ضمن الوقت معرض للتأخير `.

Per-route assertions: route reached, main visible, heading visible, content or real empty state, no runtime error, no raw i18n key, enum localized, no login redirect, loading completed, RTL.

| # | Route | Heading | Dir | Runtime | Raw keys | Enums | Checks | Result |
|---:|---|---|---|---|---|---|---:|---|
| 1 | `/admin/maintenance/machines` | الماكينات | rtl | PASS | PASS | PASS | 10 | PASS |
| 2 | `/admin/maintenance/machines/cmrx68p3i0000r095f0kcrqnz` | ماكينة تغليف10019 | rtl | PASS | PASS | PASS | 10 | PASS |
| 3 | `/admin/installed-parts` | القطع المركبة | rtl | PASS | PASS | PASS | 10 | PASS |
| 4 | `/admin/maintenance/repair-orders` | أوامر الإصلاح | rtl | PASS | PASS | PASS | 10 | PASS |
| 5 | `/admin/maintenance/bom` | قوائم مواد الصيانة | rtl | PASS | PASS | PASS | 10 | PASS |
| 6 | `/admin/reports` | التقارير | rtl | PASS | PASS | PASS | 10 | PASS |
| 7 | `/admin/reports/audit` | تقرير سجل التدقيق | rtl | PASS | PASS | PASS | 10 | PASS |
| 8 | `/admin/reports/maintenance` | نظرة عامة على الصيانة | rtl | PASS | PASS | PASS | 10 | PASS |
| 9 | `/admin/reports/maintenance/kpis` | نظرة عامة على مؤشرات الصيانة | rtl | PASS | PASS | PASS | 10 | PASS |
| 10 | `/admin/barcodes/preview` | معاينة الباركود | rtl | PASS | PASS | PASS | 10 | PASS |
| 11 | `/admin/barcodes/records` | سجلات الباركود | rtl | PASS | PASS | PASS | 10 | PASS |
| 12 | `/admin/barcodes/templates` | قوالب البطاقات | rtl | PASS | PASS | PASS | 10 | PASS |
| 13 | `/admin/barcodes/product-labels` | بطاقات المنتجات | rtl | PASS | PASS | PASS | 10 | PASS |
| 14 | `/admin/barcodes/machine-cards` | بطاقات الآلات | rtl | PASS | PASS | PASS | 10 | PASS |
| 15 | `/admin/barcodes/print-jobs` | مهام الطباعة | rtl | PASS | PASS | PASS | 10 | PASS |
| 16 | `/admin/inventory/opening-balances` | الأرصدة الافتتاحية | rtl | PASS | PASS | PASS | 10 | PASS |
| 17 | `/admin/inventory/stock-adjustments` | تسويات المخزون | rtl | PASS | PASS | PASS | 10 | PASS |
| 18 | `/admin/maintenance/sla` | اتفاقية مستوى الخدمة | rtl | PASS | PASS | PASS | 10 | PASS |
| 19 | `/admin/maintenance/workload` | تخطيط عبء العمل | rtl | PASS | PASS | PASS | 10 | PASS |
| 20 | `/admin/maintenance/calendar` | تقويم الصيانة | rtl | PASS | PASS | PASS | 10 | PASS |
| 21 | `/admin/maintenance/accountability` | مؤشرات المسؤولية | rtl | PASS | PASS | PASS | 10 | PASS |
| 22 | `/admin/reports/assets` | تقرير سجل الأصول | rtl | PASS | PASS | PASS | 10 | PASS |
| 23 | `/admin/reports/barcodes/scans` | تقرير نشاط مسح الباركود | rtl | PASS | PASS | PASS | 10 | PASS |
| 24 | `/admin/reports/inventory` | نظرة عامة على المخزون | rtl | PASS | PASS | PASS | 10 | PASS |
| 25 | `/admin/reports/inventory/adjustments` | تقرير التسويات المخزنية | rtl | PASS | PASS | PASS | 10 | PASS |
| 26 | `/admin/reports/inventory/count-variance` | تقرير تباين الجرد | rtl | PASS | PASS | PASS | 10 | PASS |
| 27 | `/admin/reports/inventory/movements` | تقرير الحركات المخزنية | rtl | PASS | PASS | PASS | 10 | PASS |
| 28 | `/admin/reports/machine-log` | سجل نشاط الآلات | rtl | PASS | PASS | PASS | 10 | PASS |
| 29 | `/admin/reports/maintenance/requests` | تقرير طلبات الصيانة | rtl | PASS | PASS | PASS | 10 | PASS |
| 30 | `/admin/reports/maintenance/schedules` | تقرير جدول الصيانة الوقائية | rtl | PASS | PASS | PASS | 10 | PASS |
| 31 | `/admin/reports/notifications` | تقرير الإشعارات | rtl | PASS | PASS | PASS | 10 | PASS |
| 32 | `/admin/reports/overdue-preventive` | الصيانة الوقائية المتأخرة | rtl | PASS | PASS | PASS | 10 | PASS |
| 33 | `/admin/reports/partners` | تقرير شركاء الأعمال | rtl | PASS | PASS | PASS | 10 | PASS |
| 34 | `/admin/reports/parts` | تقرير قطع الغيار | rtl | PASS | PASS | PASS | 10 | PASS |
| 35 | `/admin/reports/upcoming-preventive` | الصيانة الوقائية القادمة | rtl | PASS | PASS | PASS | 10 | PASS |
| 36 | `/admin/reports/user-activity` | تقرير نشاط المستخدمين | rtl | PASS | PASS | PASS | 10 | PASS |
