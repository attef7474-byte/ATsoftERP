# 03 — Duplicate Fixes

## High Priority Duplicate Fixes

### Fix 1: Inventory Adjustments vs Stock Adjustments

**Before:**
| Item | EN | AR |
|------|----|----|
| Inventory Adjustments | Inventory Adjustments | تسويات المخزون |
| Stock Adjustments | Stock Adjustments | تسويات المخزون |

**Problem:** Arabic labels identical ("تسويات المخزون" = "تسويات المخزون"). Users cannot distinguish.

**After:**
| Item | EN | AR |
|------|----|----|
| Inventory Count Adjustments | Inventory Count Adjustments | تسويات الجرد |
| Stock Adjustments | Stock Adjustments | تسويات المخزون |

**Rationale:** Both pages serve different purposes. Inventory Adjustments (`/admin/inventory/adjustments`) deals with count-based adjustments, while Stock Adjustments (`/admin/inventory/stock-adjustments`) deals with direct stock corrections. Renamed to "Inventory Count Adjustments" / "تسويات الجرد" to differentiate. Stock Adjustments kept as-is.

---

### Fix 2: Notifications (management) vs Notifications Report

**Before:**
| Item | EN | AR |
|------|----|----|
| Notifications (standalone) | Notifications | الإشعارات |
| Notifications Report | Notifications | الإشعارات |

**Problem:** Both EN and AR labels identical.

**After:**
| Item | EN | AR |
|------|----|----|
| Notifications (standalone) | Notifications | الإشعارات |
| Notifications Report | Notifications Report | تقرير الإشعارات |

**Fix:** Updated i18n value for `notificationsReport` key. The key already existed with distinct namespace, but the value was identical to `notifications`.

---

### Fix 3: Attachments (Documents) vs Attachments Report

**Before:**
| Item | EN | AR |
|------|----|----|
| Attachments (Documents) | Attachments | المرفقات |
| Attachments Report | Attachments | المرفقات |

**Problem:** Both EN and AR labels identical.

**After:**
| Item | EN | AR |
|------|----|----|
| Attachments (Documents) | Attachments | المرفقات |
| Attachments Report | Attachments Report | تقرير المرفقات |

---

### Fix 4: Audit Trail (Reports) vs Audit Log (System)

**Before:**
| Item | EN | AR |
|------|----|----|
| Audit Trail Report | Audit Trail | سجل التدقيق |
| Audit Log (System) | Audit Log | سجل التدقيق |

**Problem:** Arabic labels identical ("سجل التدقيق" = "سجل التدقيق").

**After:**
| Item | EN | AR |
|------|----|----|
| Audit Trail Report | Audit Trail Report | تقرير سجل التدقيق |
| Audit Log (System) | Audit Log | سجل التدقيق |

---

### Fix 5: User Activity (Reports) vs User Activity (System)

**Before:**
| Item | EN | AR |
|------|----|----|
| User Activity Report | User Activity | نشاط المستخدمين |
| User Activity (System) | User Activity | نشاط المستخدم |

**Problem:** English labels identical ("User Activity" = "User Activity").

**After:**
| Item | EN | AR |
|------|----|----|
| User Activity Report | User Activity Report | تقرير نشاط المستخدمين |
| User Activity (System) | User Activity | نشاط المستخدم |

---

## Naming Ambiguity Fixes

### Fix 6: Machine Parts AR

**Before:** `navigation.machineParts` → "قطع الغيار" (generic "spare parts" meaning)
**After:** `navigation.machineParts` → "قطع الماكينات" (machine-specific parts)

**Rationale:** Differentiate from `spareParts` ("قطع الغيار الاحتياطية") which refers to inventory spare parts.

---

### Fix 7: Accountability

**Before:** `navigation.maintenanceAccountability` → "Accountability" / "المسؤوليات"
**After:** `navigation.maintenanceAccountability` → "Maintenance Responsibilities" / "مسؤوليات الصيانة"

**Rationale:** Differentiate from `machineResponsibilities` ("Machine Responsibilities" / "مسؤوليات الماكينات").

---

## Barcode Label Clarity Fixes

| Key | Before (EN) | Before (AR) | After (EN) | After (AR) |
|-----|------------|------------|-----------|-----------|
| `generate` | Generate | إنشاء | Create Barcode / QR | إنشاء باركود |
| `print` | Print | طباعة | Print Barcode | طباعة الباركود |
| `scan` | Scan | مسح | Scan Barcode | مسح الباركود |
| `preview` | Preview | معاينة | Barcode Preview | معاينة الباركود |
| `records` | Records | السجلات | Barcode Records | سجلات الباركود |
| `templates` | Templates | القوالب | Barcode Templates | قوالب الباركود |

**Rationale:** Short generic labels ("Generate", "Print", "Scan") are ambiguous when viewed out of context. Adding "Barcode" makes each item self-documenting.

---

## Report Label Suffix Fixes

| Key | Before (EN) | Before (AR) | After (EN) | After (AR) |
|-----|------------|------------|-----------|-----------|
| `assetsReport` | Assets Register | سجل الأصول | Assets Report | تقرير الأصول |
| `partsReport` | Parts Inventory | مخزون قطع الغيار | Parts Inventory Report | تقرير مخزون قطع الغيار |
| `partnersReport` | Business Partners | شركاء الأعمال | Partners Report | تقرير شركاء الأعمال |
| `machineLogReport` | Machine Log | سجل الآلة | Machine Log Report | تقرير سجل الآلة |
| `partsUsageReport` | Parts Usage | استخدام القطع | Parts Usage Report | تقرير استخدام القطع |
| `upcomingPreventiveReport` | Upcoming Preventive | الصيانة الوقائية القادمة | Upcoming Preventive Report | تقرير الصيانة الوقائية القادمة |
| `overduePreventiveReport` | Overdue Preventive | الصيانة الوقائية المتأخرة | Overdue Preventive Report | تقرير الصيانة الوقائية المتأخرة |
| `lowStockReport` | Low Stock | مخزون منخفض | Low Stock Report | تقرير المخزون المنخفض |

## Items Intentionally Kept Unchanged

| Item | Reason |
|------|--------|
| Search / بحث | Global search feature, not maintenance-specific |
| Alerts / التنبيهات | Global alerts feature, not maintenance-specific |
| Spare Parts / قطع الغيار الاحتياطية | Already distinct from Machine Parts after Machine Parts rename |
| Production Lines / Operation Types / Cost Centers | Routes are under `/admin/maintenance/`; moving only the menu link would be architecturally inconsistent |
| Documents group (1 child) | Kept as-is; Documents as a group concept is valid even with one child |
