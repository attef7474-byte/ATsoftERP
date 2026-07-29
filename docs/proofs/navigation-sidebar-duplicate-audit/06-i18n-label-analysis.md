# 06 — i18n Label Analysis

## Source Files

All navigation labels come from:
- `apps/web/src/lib/i18n/locales/en/navigation.ts` (116 keys in `navigation` namespace)
- `apps/web/src/lib/i18n/locales/ar/navigation.ts` (116 keys in `navigation` namespace)
- One cross-namespace reference: `barcodes.overview.title` from `barcodes.ts`

## Label Defects Found

### Defect 1: `notificationsReport` lacks "Report" suffix

**File**: `en/navigation.ts` line 99
```typescript
notificationsReport: 'Notifications',  // should be 'Notifications Report'
```
**File**: `ar/navigation.ts` line 99
```typescript
notificationsReport: 'الإشعارات',  // should be 'تقرير الإشعارات'
```

**Impact**: The reports-group item "Notifications Report" shows the same label as the standalone "Notifications" live feed. Users cannot distinguish them.

**Pair**: D9 in duplicate analysis — EXACT_LABEL (BOTH)

---

### Defect 2: `attachmentsReport` lacks "Report" suffix

**File**: `en/navigation.ts` line 96
```typescript
attachmentsReport: 'Attachments',  // should be 'Attachments Report'
```
**File**: `ar/navigation.ts` line 96
```typescript
attachmentsReport: 'المرفقات',  // should be 'تقرير المرفقات'
```

**Impact**: The reports-group item "Attachments" shows the same label as the documents-group "Attachments". Users navigating in either language see identical labels.

**Pair**: D10 in duplicate analysis — EXACT_LABEL (BOTH)

---

### Defect 3: `auditTrailReport` vs `auditLog` — AR identical

**File**: `en/navigation.ts` lines 97-98
```typescript
auditTrailReport: 'Audit Trail',
auditLog: 'Audit Log',
```
**File**: `ar/navigation.ts` lines 97-98
```typescript
auditTrailReport: 'سجل التدقيق',
auditLog: 'سجل التدقيق',  // IDENTICAL
```

**Impact**: Arabic users see "سجل التدقيق" for both items. The EN version uses different words ("Trail" vs "Log") but AR maps both to the same string.

**Pair**: D7 in duplicate analysis — EXACT_LABEL (AR)

---

### Defect 4: `userActivityReport` vs `userActivity` — EN identical

**File**: `en/navigation.ts` lines 98, 112
```typescript
userActivityReport: 'User Activity',
userActivity: 'User Activity',  // IDENTICAL
```
**File**: `ar/navigation.ts` lines 98, 112
```typescript
userActivityReport: 'نشاط المستخدمين',  // plural
userActivity: 'نشاط المستخدم',  // singular — slightly different
```

**Impact**: English users see identical "User Activity" for both. AR is slightly different (plural vs singular).

**Pair**: D8 in duplicate analysis — EXACT_LABEL (EN)

---

### Defect 5: Cross-namespace inconsistency for barcode overview

The `barcode-overview` nav child (line 56 in `navigation-data.ts`) uses `label: 'barcodes.overview.title'` instead of a `navigation.*` key like all other nav items. While this technically works because the i18n provider resolves cross-namespace, it creates inconsistency:

- If the provider ever enforces namespace isolation, this will break
- The label source is different from all other sidebar items
- No corresponding `navigation.*` key exists for "Barcode Overview" or "Barcodes Home"

---

### Defect 6: `stockAdjustments` and `inventoryAdjustments` share AR label

**File**: `ar/navigation.ts` lines 21, 56
```typescript
inventoryAdjustments: 'تسويات المخزون',
stockAdjustments: 'تسويات المخزون',  // IDENTICAL
```
**File**: `en/navigation.ts` lines 21, 56
```typescript
inventoryAdjustments: 'Inventory Adjustments',
stockAdjustments: 'Stock Adjustments',  // different
```

**Impact**: Arabic users see identical labels for two different nav items.

**Pair**: D1 in duplicate analysis — EXACT_LABEL (AR)

---

## Summary of Defects

| # | Sidebar Items Affected | EN Defect | AR Defect | Severity |
|---|----------------------|-----------|-----------|----------|
| 1 | Notifications / Notifications Report | `notificationsReport` missing "Report" | `notificationsReport` missing "تقرير" | HIGH |
| 2 | Attachments / Attachments Report | `attachmentsReport` missing "Report" | `attachmentsReport` missing "تقرير" | HIGH |
| 3 | Audit Trail / Audit Log | OK (distinct) | `auditTrailReport` = `auditLog` = "سجل التدقيق" | MEDIUM |
| 4 | User Activity / User Activity | `userActivityReport` = `userActivity` = "User Activity" | OK (slightly distinct) | MEDIUM |
| 5 | Barcode overview | Cross-namespace risk | Cross-namespace risk | LOW |
| 6 | Stock Adjustments / Inventory Adjustments | OK (distinct) | `stockAdjustments` = `inventoryAdjustments` = "تسويات المخزون" | MEDIUM |

## i18n Key Count Verification

| Namespace | EN keys | AR keys | Match |
|-----------|---------|---------|-------|
| `navigation` | 116 | 116 | ✅ 100% |

The navigation namespace itself is balanced (same 116 keys in both languages). The defects are in the *values* assigned to those keys, not in missing keys.
