# 04 — Duplicate & Overlap Analysis

## Taxonomy

| Code | Category | Definition |
|------|----------|------------|
| EXACT_LABEL | Identical visible label in same language | EXACT_LABEL (EN) / (AR) / (BOTH) |
| SAME_ROUTE | Two nav items pointing to the same URL | — |
| SAME_FUNCTION | Two items providing the same operation | — |
| REPORT_VS_MANAGEMENT | Same data/operation available as both a management page and a report | — |
| LOG_VS_REPORT | A log page and its corresponding report | — |
| OPERATION_VS_LEDGER | An action page vs the aggregated view of those actions | — |
| NAMING_AMBIGUITY | Labels that are confusingly similar | — |
| WRONG_GROUP | Item placed in an illogical group | — |
| INTENTIONAL | Duplicate kept by design (e.g. power user vs report reader path) | — |
| ACCIDENTAL | Duplicate that likely resulted from copy-paste or lack of coordination | — |

---

## Duplicate Pairs

### D1: Inventory Adjustments ↔ Stock Adjustments

| Attribute | inv-adjustments | inv-stock-adjustments |
|-----------|----------------|----------------------|
| Route | `/admin/inventory/adjustments` | `/admin/inventory/stock-adjustments` |
| EN label | Inventory Adjustments | Stock Adjustments |
| AR label | تسويات المخزون | تسويات المخزون |
| i18n key | `navigation.inventoryAdjustments` | `navigation.stockAdjustments` |
| Nav ID | inv-adjustments | inv-stock-adjustments |

- **Category: ACCIDENTAL + EXACT_LABEL (AR)**
- **Analysis**: The Arabic labels are **identical**. The English labels are close but not identical. This is almost certainly a case of two separate implementations added at different times (legacy vs refactored) for the same class of operations. Users will be confused which one to use.
- **Risk**: HIGH — users will not know which adjustment page to use
- **Recommendation**: Merge into a single entry with a unified page, or clearly differentiate (e.g., "Simple Adjustments" vs "Batch Adjustments"/"Stock Correction")

---

### D2: Inventory Movements ↔ Inventory Ledger

| Attribute | inv-movements | inv-ledger |
|-----------|--------------|------------|
| Route | `/admin/inventory/movements` | `/admin/inventory/ledger` |
| EN label | Inventory Movements | Inventory Ledger |
| AR label | حركات المخزون | دفتر حركات المخزون |
| i18n key | `navigation.inventoryMovements` | `navigation.inventoryLedger` |

- **Category: OPERATION_VS_LEDGER**
- **Analysis**: Movements shows individual transactions. Ledger shows the aggregated book. Both deal with stock movements. The AR labels are distinct but related.
- **Risk**: MEDIUM — power users understand the difference, but daily operators may be confused
- **Recommendation**: Keep both but add descriptive subtitles or tooltips. Consider renaming to make the distinction obvious.

---

### D3: Inventory Balances ↔ Inventory Balances Report

| Attribute | inv-balances | rpt-inv-balances |
|-----------|-------------|-----------------|
| Route | `/admin/inventory/balances` | `/admin/reports/inventory/balances` |
| EN label | Inventory Balances | Inventory Balances Report |
| AR label | أرصدة المخزون | تقرير أرصدة المخزون |
| Group | Inventory | Reports |

- **Category: REPORT_VS_MANAGEMENT — INTENTIONAL**
- **Analysis**: The management page allows viewing/searching current balances. The report page generates printable/exportable balance reports. Labels are clearly distinguished.
- **Risk**: LOW
- **Recommendation**: No change needed.

---

### D4: Inventory Movements ↔ Inventory Movements Report

| Attribute | inv-movements | rpt-inv-movements |
|-----------|--------------|------------------|
| Route | `/admin/inventory/movements` | `/admin/reports/inventory/movements` |
| Group | Inventory | Reports |

- **Category: REPORT_VS_MANAGEMENT — INTENTIONAL**
- **Risk**: LOW
- **Recommendation**: No change needed.

---

### D5: Inventory Adjustments ↔ Inventory Adjustments Report

| Attribute | inv-adjustments | rpt-inv-adjustments |
|-----------|----------------|---------------------|
| Group | Inventory | Reports |

- **Category: REPORT_VS_MANAGEMENT — INTENTIONAL**
- **Risk**: LOW
- **Recommendation**: No change needed.

---

### D6: Inventory Counts ↔ Count Variance Report

| Attribute | inv-counts | rpt-inv-count-variance |
|-----------|-----------|------------------------|
| EN label | Inventory Counts | Count Variance Report |
| AR label | جرد المخزون | تقرير تباين الجرد |
| Group | Inventory | Reports |

- **Category: REPORT_VS_MANAGEMENT — INTENTIONAL**
- **Analysis**: Different concepts: counts = performing the count; count variance = analyzing discrepancies.
- **Risk**: LOW
- **Recommendation**: No change needed.

---

### D7: Audit Trail (Reports) ↔ Audit Log (System)

| Attribute | rpt-audit | sys-audit |
|-----------|-----------|-----------|
| Route | `/admin/reports/audit` | `/admin/settings/audit` |
| EN label | Audit Trail | Audit Log |
| AR label | سجل التدقيق | سجل التدقيق |
| Group | Reports | System |

- **Category: REPORT_VS_MANAGEMENT + EXACT_LABEL (AR)**
- **Analysis**: Both show audit data, but from different perspectives. The EN labels are distinct ("Trail" vs "Log"), but the **Arabic labels are identical** — both show "سجل التدقيق". Arabic users cannot tell them apart.
- **Risk**: MEDIUM (AR users)
- **Recommendation**: Differentiate Arabic labels. For example: "سجل التدقيق (تقارير)" vs "سجل التدقيق (النظام)" or use distinct terminology like "تقرير التدقيق" vs "سجل التدقيق".

---

### D8: User Activity (Reports) ↔ User Activity (System)

| Attribute | rpt-user-activity | sys-user-activity |
|-----------|-------------------|-------------------|
| Route | `/admin/reports/user-activity` | `/admin/settings/audit/user-activity` |
| EN label | User Activity | User Activity |
| AR label | نشاط المستخدمين | نشاط المستخدم |
| Group | Reports | System |

- **Category: EXACT_LABEL (EN)**
- **Analysis**: The **English labels are identical** ("User Activity" for both). The AR labels differ slightly (plural vs singular). Users navigating in English will see the same label and cannot tell which is which.
- **Risk**: MEDIUM (EN users)
- **Recommendation**: Rename one. For example: "User Activity Report" vs "User Activity Log". Or rename reports one to "Activity Reports".

---

### D9: Notifications (standalone) ↔ Notifications Report

| Attribute | notifications | rpt-notifications |
|-----------|--------------|-------------------|
| Route | `/admin/notifications` | `/admin/reports/notifications` |
| EN label | Notifications | Notifications |
| AR label | الإشعارات | الإشعارات |
| Group | — (standalone) | Reports |

- **Category: EXACT_LABEL (BOTH)**
- **Analysis**: Both EN and AR labels are **completely identical**. The standalone item is a live feed. The report item is a historical analysis. A user sees two "Notifications" entries and cannot tell them apart without clicking.
- **Risk**: HIGH
- **Recommendation**: Rename the report to "Notifications Report" in both languages (EN key exists as `navigation.notificationsReport` — this is already the key used! Let me verify...)

Check: In `navigation-data.ts` line 90: `{ id: 'rpt-notifications', label: 'navigation.notificationsReport', ... }`
In i18n EN: `notificationsReport: 'Notifications'`
In i18n AR: `notificationsReport: 'الإشعارات'`

The i18n key `navigation.notificationsReport` has value **"Notifications"** (no "Report" suffix in EN!) and **"الإشعارات"** in AR. This is a **label data issue** — the English and Arabic translations should include "Report" / "تقرير" to distinguish the two items.

---

### D10: Attachments (Documents) ↔ Attachments Report

| Attribute | doc-attachments | rpt-attachments |
|-----------|----------------|-----------------|
| Route | `/admin/documents/attachments` | `/admin/reports/attachments` |
| EN label | Attachments | Attachments |
| AR label | المرفقات | المرفقات |
| Group | Documents | Reports |

- **Category: EXACT_LABEL (BOTH) + WRONG_GROUP**
- **Analysis**: Both EN and AR labels are **completely identical**. One is under Documents group (file management), the other under Reports group (attachment report). Users see two "Attachments" / "المرفقات" entries in different groups and don't know which is which.
- **Risk**: HIGH
- **Recommendation**: Rename the report to "Attachments Report" in both languages, or rename the documents one to "Document Attachments" / "مرفقات المستندات".

---

### D11: Machine Parts ↔ Spare Parts

| Attribute | mnt-machine-parts | mnt-spare-parts |
|-----------|------------------|-----------------|
| Route | `/admin/maintenance/machine-parts` | `/admin/maintenance/spare-parts` |
| EN label | Machine Parts | Spare Parts |
| AR label | قطع الغيار | قطع الغيار الاحتياطية |

- **Category: NAMING_AMBIGUITY**
- **Analysis**: The EN labels are distinct. In AR, "قطع الغيار" (Machine Parts) and "قطع الغيار الاحتياطية" (Spare Parts) are confusingly similar. New users may not understand the difference between "machine-specific parts" and "inventory spare parts".
- **Risk**: MEDIUM
- **Recommendation**: In AR, consider renaming Machine Parts to "قطع الماكينات" to better differentiate. Or add descriptions.

---

### D12: Machine Responsibilities ↔ Accountability

| Attribute | mnt-machine-responsibilities | mnt-accountability |
|-----------|-----------------------------|-------------------|
| Route | `/admin/maintenance/machine-responsibilities` | `/admin/maintenance/accountability` |
| EN label | Machine Responsibilities | Accountability |
| AR label | مسؤوليات الماكينات | المسؤوليات |

- **Category: NAMING_AMBIGUITY**
- **Analysis**: Both deal with person-asset assignment. The AR labels share the root word "مسؤوليات" / "المسؤوليات". Users may need to click both to understand the difference.
- **Risk**: MEDIUM (AR)
- **Recommendation**: In AR, differentiate clearly. Consider "توزيع المسؤوليات" for Accountability or "مسؤوليات الأفراد".

---

### D13: Scan (Barcodes) ↔ Scans / Scan History (Barcodes) ↔ Barcode Scans Report (Reports)

| Attribute | barcode-scan | barcode-scans | rpt-barcode-scans |
|-----------|-------------|---------------|-------------------|
| Route | `/admin/barcodes/scan` | `/admin/barcodes/scans` | `/admin/reports/barcodes/scans` |
| EN label | Scan | Scan History | Barcode Scans Report |
| AR label | مسح | سجل المسح | تقرير فحوصات الباركود |

- **Category: NAMING_AMBIGUITY**
- **Analysis**: Three different items with "scan" in the name. The labels are clearly differentiated in both languages, but the similar root words could confuse. "Scan" (action) vs "Scan History" (log) vs "Barcode Scans Report" (report) are in two different groups.
- **Risk**: LOW
- **Recommendation**: No change needed — labels are adequately differentiated.

---

## Summary Count

| Category | Count | Pairs |
|----------|-------|-------|
| EXACT_LABEL (AR) | 2 | D1 (Inv Adj vs Stock Adj), D7 (Audit Report vs Audit System) |
| EXACT_LABEL (EN) | 1 | D8 (User Activity Report vs System) |
| EXACT_LABEL (BOTH) | 2 | D9 (Notifications vs Notifications Report), D10 (Attachments vs Attachments Report) |
| REPORT_VS_MANAGEMENT | 5 | D3, D4, D5, D6, D7 |
| OPERATION_VS_LEDGER | 1 | D2 |
| NAMING_AMBIGUITY | 3 | D11 (Machine Parts vs Spare Parts), D12 (Machine Responsibilities vs Accountability), D13 (Scan/Scans/Scans Report) |
| ACCIDENTAL | 1 | D1 |
| INTENTIONAL | 5 | D3, D4, D5, D6, D7 |

**Note**: Some pairs fall into multiple categories.
