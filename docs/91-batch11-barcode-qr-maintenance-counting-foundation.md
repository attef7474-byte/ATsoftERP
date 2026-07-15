# الدفعة 11: أساسيات الباركود و QR للصيانة والجرد

**التاريخ:** 15 يوليو 2026  
**الفرع:** main  
**الكوميت:** 86153da  
**الوسم:** atsoft-erp-barcode-qr-maintenance-counting-foundation

---

## 1. نظرة عامة

تم في هذه الدفعة بناء البنية التحتية للباركود و QR لأنظمة الصيانة (CMMS) والجرد. تم إضافة سجل مركزي للملصقات (BarcodeLabel)، وسجل غير قابل للتعديل لعمليات المسح (BarcodeScanEvent)، ونماذج الملصقات (BarcodeLabelTemplate)، مع نقاط نهاية واجهة برمجة التطبيقات كاملة للإنشاء والمسح والتحليل والسياقات التشغيلية.

---

## 2. التعديلات في قاعدة البيانات (Prisma)

### جدول BarcodeLabel (barcode_labels)
- `id` (String, CUID) - المعرف الفريد
- `code` (String, فريد) - كود الملصق (يولد تلقائياً عبر NumberSequence)
- `value` (String, فريد) - قيمة الباركود (نص أو JSON)
- `symbology` (String) - نوع الترميز: QR_CODE, CODE128, DATA_MATRIX, EAN13
- `entityType` (String) - نوع الكيان المرتبط (MACHINE, PRODUCT, ...)
- `entityId` (String) - معرّف الكيان المرتبط
- `title` (String?) - عنوان وصفي
- `status` (String, default ACTIVE) - الحالة: ACTIVE, INACTIVE, RETIRED, VOID
- `metadata` (Json?) - بيانات إضافية
- `lastScannedAt` (DateTime?) - تاريخ آخر مسح
- `scanCount` (Int, default 0) - عدد مرات المسح
- `printedAt` (DateTime?) - تاريخ آخر طباعة
- `printCount` (Int, default 0) - عدد مرات الطباعة
- `companyId`, `branchId` (String?) - الربط بالشركة والفرع
- `createdAt`, `updatedAt`, `deletedAt` - الطوابع الزمنية
- `@@unique([code, companyId])` + `@@unique([value, companyId])`

### جدول BarcodeScanEvent (barcode_scan_events)
- سجل غير قابل للتعديل لجميع عمليات المسح
- `labelId` (String?) - رابط للملصق
- `scannedValue` (String) - القيمة الممسوحة (نص)
- `symbology` (String?) - نوع الترميز
- `purpose` (String) - الغرض من المسح
- `result` (String) - النتيجة: SUCCESS, NOT_FOUND, WRONG_CONTEXT, إلخ
- `source` (String, default WEB) - المصدر
- `entityType`, `entityId` (String?) - الكيان المرتبط
- `contextType`, `contextId` (String?) - سياق المسح
- `message` (String?) - رسالة توضيحية
- `scannedById` (String?) - معرف المستخدم الماسح
- `ipAddress`, `userAgent` (String?)
- `scannedAt` (DateTime, default now) - تاريخ المسح
- فهارس على `labelId`, `scannedValue`, `purpose`, `result`, `entityType`

### جدول BarcodeLabelTemplate (barcode_label_templates)
- `id`, `name` (فريد), `description`, `symbology`, `config` (Json)
- `entityType` (String?) - نوع الكيان المخصص له
- `width`, `height`, `labelPerRow`, `dpi` (Int?)
- `status` (String, default ACTIVE)
- `companyId`, `branchId`
- طوابع زمنية كاملة

### الهجرة (Migration)
- `20260715012915_barcode_qr_foundation`
- `prisma validate` + `prisma generate` ناجحان

---

## 3. صلاحيات الباركود (Permissions)

تمت إضافة 23 صلاحية في `seed-barcode-permissions.ts`:

| الوحدة | الصلاحيات |
|--------|-----------|
| barcode-label | create, read, update, delete, activate, deactivate, retire, void, print, resolve |
| barcode-scan | create, read, resolve, inventory-count, maintenance, machine-check, part-lookup |
| barcode-template | create, read, update, delete, activate, deactivate |

### تسلسلات الأرقام
- `BARCODE_LABEL` - رمز BL- لتوليد أكواد الملصقات
- `QR_LABEL` - رمز QR- لتوليد أكواد QR

---

## 4. واجهة برمجة التطبيقات (API)

### نقطة النهاية الأساسية
```
@Controller({ path: 'barcodes', version: '1' }) → /api/v1/barcodes/...
```

### BarcodeLabelsController (12 نقطة نهاية)
| الطريقة | المسار | الوظيفة |
|---------|--------|---------|
| POST | /barcodes/labels | إنشاء ملصق |
| POST | /barcodes/labels/generate | إنشاء تلقائي مع كود NumberSequence |
| GET | /barcodes/labels | قائمة الملصقات (مع ترشيح) |
| GET | /barcodes/labels/:id | عرض ملصق |
| PATCH | /barcodes/labels/:id | تحديث ملصق |
| PATCH | /barcodes/labels/:id/activate | تفعيل |
| PATCH | /barcodes/labels/:id/deactivate | إلغاء تفعيل |
| PATCH | /barcodes/labels/:id/retire | تقاعد |
| PATCH | /barcodes/labels/:id/void | إلغاء |
| POST | /barcodes/labels/:id/mark-printed | تسجيل طباعة |
| GET | /barcodes/entities/:entityType/:entityId/labels | ملصقات الكيان |
| GET | /barcodes/resolve | تحليل قيمة باركود |
| POST | /barcodes/resolve | تحليل قيمة باركود (POST) |

### BarcodeScansController (7 نقاط نهاية)
| الطريقة | المسار | الوظيفة |
|---------|--------|---------|
| POST | /barcodes/scan | مسح عام |
| GET | /barcodes/scans | سجل المسح |
| GET | /barcodes/scans/:id | تفاصيل مسح |
| POST | /barcodes/scan/inventory-count | مسح جرد |
| POST | /barcodes/scan/maintenance | مسح صيانة |
| POST | /barcodes/scan/machine-check | فحص ماكينة |
| POST | /barcodes/scan/part-lookup | بحث قطعة غيار |

### BarcodeTemplatesController (6 نقاط نهاية)
| الطريقة | المسار | الوظيفة |
|---------|--------|---------|
| POST | /barcodes/templates | إنشاء قالب |
| GET | /barcodes/templates | قائمة القوالب |
| GET | /barcodes/templates/:id | عرض قالب |
| PATCH | /barcodes/templates/:id | تحديث قالب |
| PATCH | /barcodes/templates/:id/activate | تفعيل |
| PATCH | /barcodes/templates/:id/deactivate | إلغاء تفعيل |

### نقاط النهاية السياقية

#### مسح الجرد (scan/inventory-count)
- يقبل `value`, `inventoryCountId`, `countedQty` اختياري, `locationId` اختياري
- يدعم ENTITY_TYPES: PRODUCT, WAREHOUSE_LOCATION, WAREHOUSE, INVENTORY_COUNT, INVENTORY_COUNT_LINE
- يتحقق من حالة الجرد (يرفض COMPLETED/CANCELLED)
- ينشئ أو يحدث بند الجرد مع الكمية المعدودة
- يمنع تحديث البنود المُحققة (VERIFIED)

#### مسح الصيانة (scan/maintenance)
- يقبل `value`, `purpose` اختياري, `maintenanceRequestId`/`maintenanceTaskId` اختياري
- يدعم ENTITY_TYPES: MACHINE, MACHINE_PART, MAINTENANCE_REQUEST, MAINTENANCE_TASK, DOWNTIME_LOG
- يعرض ملخص الكيان + الإجراءات المقترحة

#### فحص الماكينة (scan/machine-check)
- يقبل `value` فقط
- يقبل MACHINE فقط
- يعرض إحصائيات تشغيلية: الطلبات النشطة، المهام المفتوحة، وقت التوقف
- الإجراءات المقترحة: إنشاء طلب صيانة، بدء توقف، عرض المهام، عرض قطع الغيار

#### بحث قطعة الغيار (scan/part-lookup)
- يقبل `value` فقط
- يدعم MACHINE_PART و PRODUCT
- يعرض الأرصدة المخزنية عبر المستودعات والمواقع

### المصادقة والتفويض
- جميع نقاط النهاية محمية بـ `JwtAuthGuard` + `PermissionsGuard`
- مزينة بـ `@Permissions(...)` للصلاحيات المطلوبة
- مزينة بـ `@ApiBearerAuth()` + `@ApiOperation()` للتوثيق

### تدقيق (Audit)
جميع العمليات مسجلة عبر `AuditService` مع:
- نوع الكيان ومعرّفه
- معرّف الملصق
- القيمة الممسوحة (آمنة)
- النتيجة والغرض
- سياق المسح

---

## 5. واجهة المستخدم (i18n)

تمت إضافة مساحة اسم `barcodes` في ملفات الترجمة:
- **en.ts:** 51 مفتاح للغة الإنجليزية
- **ar.ts:** 51 مفتاح للغة العربية

الكلمات المترجمة: الباركود، الملصقات، المسح، أنظمة الترميز، الإجراءات المقترحة، سجل المسح، ملخص التشغيل، وأنواع الحالات.

---

## 6. الإصلاحات

### مشكلة ضيق النطاق المتغير (TypeScript Narrowing)
كان TypeScript يفشل في تضييق نوع `resolution.label` داخل closures غير المتزامنة على الرغم من عمليات `return` المبكرة التي تتعامل مع `null`. تمت إعادة هيكلة `barcode-scans.service.ts` لاستخدام متغيرات محلية (`const label = resolution.label;`) وتمرير الدوال المساعدة، مما يضمن أن TypeScript يمكنه استنتاج النوع غير null.

### مشكلة توفر AuditService
فشل بدء تشغيل NestJS لأن `AuditService` لم يكن متاحاً في `BarcodesModule`. تم إصلاحه بإضافة `imports: [AuditModule]` في `barcodes.module.ts`.

---

## 7. البناء والتحقق

- ✅ `npx tsc --noEmit` (API) - 0 أخطاء
- ✅ `npx tsc --noEmit` (Web) - 0 أخطاء
- ✅ بدء تشغيل الخادم - جميع نقاط النهاية الـ 25 تم تسجيلها بنجاح
- ✅ Swagger UI متاح على `/api/docs`
- ✅ Git commit + tag + push ناجح

---

## 8. هيكل الملفات

```
apps/api/
├── prisma/
│   ├── migrations/20260715012915_barcode_qr_foundation/
│   │   └── migration.sql
│   ├── schema.prisma                     # 3 نماذج جديدة للباركود
│   └── seed/
│       ├── seed.ts                       # تحديث - تسلسلات + وحدات
│       └── seed-barcode-permissions.ts   # 23 صلاحية
└── src/
    └── modules/barcodes/
        ├── barcodes.module.ts
        ├── barcode-labels.controller.ts
        ├── barcode-labels.service.ts
        ├── barcode-scans.controller.ts
        ├── barcode-scans.service.ts
        ├── barcode-templates.controller.ts
        ├── barcode-templates.service.ts
        └── dto/                          # 14 ملف DTO
```

---

## 9. الخطوات القادمة (لاحقاً)

- الدفعة 12: إضافة واجهة مستخدم الباركود ضمن صفحات الصيانة والمخزون الحالية
- الدفعة 12: دمج ماسح الباركود مع FormScanInput
- طباعة الباركود عبر تقنية التوليد من الواجهة الأمامية
