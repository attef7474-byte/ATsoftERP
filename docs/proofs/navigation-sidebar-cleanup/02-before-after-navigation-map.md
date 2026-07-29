# 02 — Before/After Navigation Map

## Full Change Table

### Label Changes Only (no route changes, no permission changes)

| Old Group | Old Arabic | Old English | Old i18n Key | Problem | New Arabic | New English | New Route | Route Changed? | Permission Changed? |
|-----------|-----------|-------------|-------------|---------|-----------|-------------|-----------|---------------|---------------------|
| Inventory | تسويات المخزون | Inventory Adjustments | `inventoryAdjustments` | AR duplicate with stockAdjustments | تسويات الجرد | Inventory Count Adjustments | `/admin/inventory/adjustments` | NO | NO |
| Inventory | تسويات المخزون | Stock Adjustments | `stockAdjustments` | AR duplicate with inventoryAdjustments | تسويات المخزون | Stock Adjustments | `/admin/inventory/stock-adjustments` | NO | NO |
| Maintenance | المسؤوليات | Accountability | `maintenanceAccountability` | Ambiguous vs Machine Responsibilities | مسؤوليات الصيانة | Maintenance Responsibilities | `/admin/maintenance/accountability` | NO | NO |
| Maintenance | قطع الغيار | Machine Parts | `machineParts` | Ambiguous AR with spareParts | قطع الماكينات | Machine Parts | `/admin/maintenance/machine-parts` | NO | NO |
| Barcodes | إنشاء | Generate | `generate` | Too generic, no barcode context | إنشاء باركود | Create Barcode / QR | `/admin/barcodes/generate` | NO | NO |
| Barcodes | طباعة | Print | `print` | Too generic, no barcode context | طباعة الباركود | Print Barcode | `/admin/barcodes/print` | NO | NO |
| Barcodes | مسح | Scan | `scan` | Too generic, no barcode context | مسح الباركود | Scan Barcode | `/admin/barcodes/scan` | NO | NO |
| Barcodes | معاينة | Preview | `preview` | Too generic, no barcode context | معاينة الباركود | Barcode Preview | `/admin/barcodes/preview` | NO | NO |
| Barcodes | السجلات | Records | `records` | Too generic, no barcode context | سجلات الباركود | Barcode Records | `/admin/barcodes/records` | NO | NO |
| Barcodes | القوالب | Templates | `templates` | Too generic, no barcode context | قوالب الباركود | Barcode Templates | `/admin/barcodes/templates` | NO | NO |
| Reports | الإشعارات | Notifications | `notificationsReport` | EXACT_LABEL with standalone Notifications | تقرير الإشعارات | Notifications Report | `/admin/reports/notifications` | NO | NO |
| Reports | المرفقات | Attachments | `attachmentsReport` | EXACT_LABEL with Documents/Attachments | تقرير المرفقات | Attachments Report | `/admin/reports/attachments` | NO | NO |
| Reports | سجل التدقيق | Audit Trail | `auditTrailReport` | AR identical to System/AuditLog | تقرير سجل التدقيق | Audit Trail Report | `/admin/reports/audit` | NO | NO |
| Reports | نشاط المستخدمين | User Activity | `userActivityReport` | EN identical to System/UserActivity | تقرير نشاط المستخدمين | User Activity Report | `/admin/reports/user-activity` | NO | NO |
| Reports | سجل الأصول | Assets Register | `assetsReport` | Missing "Report" / "تقرير" | تقرير الأصول | Assets Report | `/admin/reports/assets` | NO | NO |
| Reports | مخزون قطع الغيار | Parts Inventory | `partsReport` | Missing "Report" / "تقرير" | تقرير مخزون قطع الغيار | Parts Inventory Report | `/admin/reports/parts` | NO | NO |
| Reports | شركاء الأعمال | Business Partners | `partnersReport` | Missing "Report" / "تقرير" | تقرير شركاء الأعمال | Partners Report | `/admin/reports/partners` | NO | NO |
| Reports | سجل الآلة | Machine Log | `machineLogReport` | Missing "Report" / "تقرير" | تقرير سجل الآلة | Machine Log Report | `/admin/reports/machine-log` | NO | NO |
| Reports | استخدام القطع | Parts Usage | `partsUsageReport` | Missing "Report" / "تقرير" | تقرير استخدام القطع | Parts Usage Report | `/admin/reports/parts-usage` | NO | NO |
| Reports | الصيانة الوقائية القادمة | Upcoming Preventive | `upcomingPreventiveReport` | Missing "Report" / "تقرير" | تقرير الصيانة الوقائية القادمة | Upcoming Preventive Report | `/admin/reports/upcoming-preventive` | NO | NO |
| Reports | الصيانة الوقائية المتأخرة | Overdue Preventive | `overduePreventiveReport` | Missing "Report" / "تقرير" | تقرير الصيانة الوقائية المتأخرة | Overdue Preventive Report | `/admin/reports/overdue-preventive` | NO | NO |
| Reports | مخزون منخفض | Low Stock | `lowStockReport` | Missing "Report" / "تقرير" | تقرير المخزون المنخفض | Low Stock Report | `/admin/reports/low-stock` | NO | NO |

### Icon Change

| Item | Old Icon | New Icon | Changed? |
|------|---------|---------|----------|
| Alerts | dashboard (home icon) | notification (bell icon) | YES — more appropriate |

### Reports Group Reordering

**Before (unsorted):**
1. Reports Home → Maintenance Overview → KPI Report → Maintenance Requests → Downtime → Costs → Schedules → Inventory Overview → Inv Balances Report → Inv Movements → Inv Adjustments → Count Variance → Barcode Scans → Assets → Parts → Partners → Attachments Report → Audit Trail → User Activity → Notifications → Machine Log → Parts Usage → Upcoming PM → Overdue PM → Low Stock

**After (thematic ordering with comments):**
1. Reports Home
2. Maintenance Reports (13 items: Overview, KPI, Requests, Downtime, Costs, Schedules, Assets, Machine Log, Parts Usage, Upcoming PM, Overdue PM, Parts Inventory, Low Stock)
3. Inventory Reports (5 items: Overview, Balances, Movements, Adjustments, Count Variance)
4. Barcode Reports (1 item: Scans)
5. System Reports (4 items: Audit Trail, User Activity, Notifications, Attachments) + Partners Report

**No items deleted. No items moved between groups. Routes unchanged.**
