# الدفعة 10: التقوية التشغيلية لنظام الصيانة (CMMS) والجرد

**التاريخ:** 15 يوليو 2026  
**الفرع:** main  
**الكوميت:** d094874  
**الوسم:** atsoft-erp-cmms-inventory-operational-hardening  

---

## 1. نظرة عامة

تم في هذه الدفعة تقوية الجانب التشغيلي لوحدتي الصيانة (CMMS) والجرد بإضافة التحقق من صحة دورة حياة السجلات، ونقاط النهاية الملخصة، وتحسين سجل التدقيق، وتحسين واجهة المستخدم ضمن الصفحات الحالية.

---

## 2. التعديلات في قاعدة البيانات

### جدول MaintenanceTask
- إضافة `startedAt` (DateTime?) - تاريخ بدء المهمة
- إضافة `completedAt` (DateTime?) - تاريخ إكمال المهمة  
- إضافة `cancelledAt` (DateTime?) - تاريخ إلغاء المهمة

### جدول DowntimeLog
- إضافة `cancelledAt` (DateTime?) - تاريخ إلغاء سجل التوقف

### ملف الترحيل
- `apps/api/prisma/migrations/20260715005849_cmms_inventory_operational_hardening/`

---

## 3. تقوية واجهة الخلفية (Backend)

### 3.1 الصيانة (CMMS)

#### طلبات الصيانة (MaintenanceRequest)
- `start()` - تعيين حالة الماكينة إلى `UNDER_MAINTENANCE`
- `complete()` - إعادة الماكينة إلى `ACTIVE` في حال عدم وجود طلبات نشطة أخرى
- `cancel()` - معالجة انتقال حالة الماكينة
- رفض أي تعديل على الطلبات المكتملة أو الملغاة

#### مهام الصيانة (MaintenanceTask)
- `start()` - تعيين `startedAt` ومنع البدء المكرر
- `complete()` - تعيين `completedAt` والتأكد من أن المهمة قيد التشغيل
- `cancel()` - تعيين `cancelledAt` ومنع إلغاء المهام المكتملة
- رفض أي تعديل على المهام المكتملة أو الملغاة

#### سجلات التوقف (DowntimeLog)
- `cancel()` - تعيين `cancelledAt` مع التحقق من أن السجل ليس مقفلاً أو ملغياً
- `close()` - حساب `durationMinutes` تلقائياً
- منع إنشاء أكثر من توقف نشط لنفس الماكينة في نفس الوقت

#### جداول الصيانة (MaintenanceSchedule)
- `computeDueStatus()` - حساب حالة الاستحقاق: `overdue`، `dueSoon`، `notDue`، `inactive`، `expired`
- فلترة حسب `dueBefore` (تاريخ) و `dueStatus` (نص)

#### نقاط النهاية الملخصة للصيانة
- `GET /api/maintenance/summary/machines` - ملخص تشغيلي للماكينات
- `GET /api/maintenance/summary/machines/:id` - ملخص ماكينة واحدة
- `GET /api/maintenance/summary/requests` - إحصائيات الطلبات
- `GET /api/maintenance/summary/downtime` - إحصائيات التوقفات
- `GET /api/maintenance/summary/schedules` - إحصائيات الجداول

### 3.2 الجرد (Inventory)

#### الجرد (InventoryCount)
- جعل السجلات المكتملة (`COMPLETED`) والملغاة (`CANCELLED`) للقراءة فقط
- رفض أي تحديث أو حذف عليها مع رسالة خطأ 400

#### بنود الجرد (InventoryCountLine)
- جعل البنود المعتمدة (`VERIFIED`) للقراءة فقط
- رفض أي تعديل أو حذف عليها

#### حركات المخزون (InventoryMovement)
- تحسين تفاصيل التدقيق عند الترحيل والإلغاء
- منع الترحيل المكرر

#### تسويات المخزون (InventoryAdjustment)
- تحسين تفاصيل التدقيق عند الترحيل والإلغاء
- منع الترحيل المكرر

#### نقاط النهاية الملخصة للمخزون
- `GET /api/inventory/summary/balances` - ملخص الأرصدة
- `GET /api/inventory/summary/counts` - ملخص الجرد
- `GET /api/inventory/summary/movements` - ملخص الحركات
- `GET /api/inventory/summary/adjustments` - ملخص التسويات

---

## 4. الصلاحيات

لا توجد صلاحيات جديدة مطلوبة. الصلاحيات الحالية (مثل `maintenance-request:start` و `inventory-count:complete`) تغطي جميع الإجراءات المضافة. تم إنشاؤها مسبقاً بواسطة ملفات البذور (`seed-cmms-permissions.ts` و `seed-inventory-counting-permissions.ts`).

---

## 5. تحسين سجل التدقيق (Audit)

جميع إجراءات دورة الحياة تسجل الآن:
- `oldStatus` - الحالة القديمة
- `newStatus` - الحالة الجديدة
- معرفات الكيانات ذات الصلة (معرف الماكينة، معرف الطلب، إلخ)

---

## 6. التحقق من صحة DTO/الخدمة

- 400/409 للانتقالات غير الصالحة (مثلاً: إكمال طلب ملغي)
- حظر التعديل على السجلات المكتملة/الملغاة/المعتمدة
- منع التوقفات النشطة المكررة بنفس الماكينة
- منطق منع الرصيد السلبي موجود مسبقاً

---

## 7. تحسين واجهة المستخدم (ضمن الصفحات الحالية)

تمت إضافة أنواع TypeScript جديدة للردود الملخصة:
- `MachineOperationalSummary` - ملخص تشغيلي للماكينة
- `OperationalSummaryResponse` - رد الملخص التشغيلي
- `RequestSummary` - إحصائيات الطلبات
- `DowntimeSummary` - إحصائيات التوقفات
- `ScheduleSummary` - إحصائيات الجداول
- `BalanceSummary` - ملخص الأرصدة
- `CountSummary` - ملخص الجرد
- `MovementSummary` - ملخص الحركات
- `AdjustmentSummary` - ملخص التسويات

تم تحديث `MaintenanceSchedule` بإضافة حقل `dueStatus`.

تم تحديث `DowntimeLog` بإضافة حقول `cancelledAt` و `durationHours`.

---

## 8. ملفات الترجمة (i18n)

### مساحة الأسماء الجديدة: `cmms`
```
operationalSummary, activeRequests, openTasks, activeDowntime,
downtimeHours, dueStatus, overdue, dueSoon, notDue, expired,
inactive, totalLines, countedLines, verifiedLines,
totalDifferenceQty, hasDifferences
```

### الإضافات لمساحة الأسماء `inventory`
```
posted, cannotPostAgain, negativeStockNotAllowed,
workflowInvalidTransition, balanceSummary, countSummary,
movementSummary, adjustmentSummary
```

---

## 9. الملفات المعدلة

| الملف | التعديل |
|-------|---------|
| `apps/api/prisma/schema.prisma` | إضافة `startedAt`/`completedAt`/`cancelledAt` لـ MaintenanceTask، و `cancelledAt` لـ DowntimeLog |
| `apps/api/prisma/migrations/20260715005849_*/migration.sql` | ملف الترحيل الجديد |
| `apps/api/src/.../maintenance-requests.service.ts` | تقوية دورة الحياة مع انتقال حالة الماكينة |
| `apps/api/src/.../maintenance-tasks.service.ts` | تقوية دورة الحياة مع `startedAt`/`completedAt`/`cancelledAt` |
| `apps/api/src/.../downtime-logs.service.ts` | إغلاق/إلغاء مع حساب المدة ومنع التكرار |
| `apps/api/src/.../downtime-logs.controller.ts` | إضافة مساري `close` و `cancel` |
| `apps/api/src/.../maintenance-schedules.service.ts` | `computeDueStatus` ومرشحات `dueBefore`/`dueStatus` |
| `apps/api/src/.../maintenance-schedules.controller.ts` | إضافة معلمات `dueBefore`/`dueStatus` لـ GET |
| `apps/api/src/.../maintenance.service.ts` | دوال الملخص التشغيلي للماكينات والطلبات والتوقفات والجداول |
| `apps/api/src/.../maintenance.controller.ts` | 5 مسارات ملخصة للصيانة |
| `apps/api/src/.../inventory-counts.service.ts` | حظر التعديل على المكتمل/الملغي |
| `apps/api/src/.../inventory-count-lines.service.ts` | حظر التعديل على المعتمد |
| `apps/api/src/.../inventory-movements.service.ts` | تحسين التدقيق |
| `apps/api/src/.../inventory-adjustments.service.ts` | تحسين التدقيق |
| `apps/api/src/.../inventory-balances.service.ts` | دوال الملخص (balances/counts/movements/adjustments) |
| `apps/api/src/.../inventory-balances.controller.ts` | 4 مسارات ملخصة للمخزون |
| `apps/api/src/.../inventory-balances.module.ts` | تسجيل InventorySummaryController |
| `apps/web/src/lib/admin-types.ts` | أنواع Summary الجديدة |
| `apps/web/src/lib/i18n/locales/ar.ts` | ترجمات عربية للمساحات الجديدة |
| `apps/web/src/lib/i18n/locales/en.ts` | ترجمات إنجليزية للمساحات الجديدة |
| `apps/web/src/lib/i18n/types.ts` | إضافة مساحة اسم `cmms` |

---

## 10. التحقق من البناء

- ✅ بناء API (TypeScript): نجح
- ✅ بناء الويب (Next.js): نجح
- ✅ بدء التشغيل: API تعمل على `http://localhost:4000`
- ✅ التوثيق: Swagger على `http://localhost:4000/api/docs`
- ✅ التحقق من عدم وجود صفحات جديدة: لا توجد ملفات `page.tsx` جديدة
- ✅ الرفع إلى GitHub: تم الرفع إلى `origin/main` مع الوسم

---

## 11. الخطوات القادمة (الدفعة 11)

- بدء واجهة المشتريات (Purchasing) مع دورة حياة طلبات الشراء
- تكامل المخزون مع المشتريات
- نظام الموافقات المتقدم (Advanced Approval Engine)
