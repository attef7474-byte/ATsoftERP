# سير عمل أمر الإصلاح / Repair Order Workflow

| الحقل / Field | القيمة / Value |
|---|---|
| **رقم الـ SOP / SOP ID** | SOP-MNT-003 |
| **رقم الإصدار / Version** | 1.0 |
| **تاريخ التفعيل / Effective Date** | 2026-07-29 |
| **آخر مراجعة / Last Reviewed** | 2026-07-29 |
| **النظام / System** | ATsoft ERP — Maintenance (CMMS) |

---

## 1. الغرض / Purpose

### العربية
توحيد إجراءات إصلاح قطع الغيار التالفة المعاد تدويرها من خلال دورة حياة الإصلاح الكاملة، بدءًا من استلام القطعة من مخزون الصيانة وحتى إعادتها إلى المخزون بحالة صالحة للاستخدام أو التخلص منها.

### English
Standardize the process of repairing returned defective spare parts through the complete repair lifecycle, from receiving the part from maintenance stock issue to returning it to inventory in serviceable condition or scrapping it.

---

## 2. النطاق / Scope

### العربية
- قطع الغيار القابلة للإصلاح ضمن رصيد الحالة SPARE_PART في نظام الأرصدة الشرطية.
- ينطبق على القطع التي يتم إرجاعها من أمر صرف مخزون الصيانة (Maintenance Stock Issue).
- لا يشمل قطع الغيار غير القابلة للإصلاح أو المشطوبة نهائيًا.

### English
- Repairable spare parts tracked in the SPARE_PART condition balance ledger.
- Applies to parts returned from a maintenance stock issue.
- Does NOT cover non-repairable or permanently scrapped parts.

---

## 3. الأدوار / Roles

| الدور (عربي) | Role | المسؤوليات / Responsibilities |
|---|---|---|
| **منسق الإصلاح** | Repair Coordinator | إنشاء أمر الإصلاح (DRAFT) وفتحه للمعالجة (OPEN) |
| **المراجع الفاحص** | Inspector | فحص القطعة وتقدير تكلفة الإصلاح (IN_INSPECTION) |
| **فني الإصلاح** | Repair Technician | تنفيذ أعمال الإصلاح وتسجيل الإجراءات وقطع الغيار المستخدمة (UNDER_REPAIR) |
| **مختبر الجودة** | Quality Tester | اختبار القطعة بعد الإصلاح والتحقق من مطابقتها للمواصفات (UNDER_TEST) |
| **أمين المستودع** | Store Keeper | إدارة أرصدة الحالة الشرطية (تحويل OUT/IN بين الحالات) |

---

## 4. تدفق الحالات الكامل / Complete Status Flow

```
                    ┌─────────────┐
                    │   DRAFT     │  ← الإنشاء
                    └──────┬──────┘
                           │ فتح
                           ▼
                    ┌─────────────┐
                    │    OPEN     │
                    └──────┬──────┘
                           │ فحص
                           ▼
                    ┌─────────────┐
                    │IN_INSPECTION│
                    └──────┬──────┘
                           │ موافقة
                           ▼
                    ┌─────────────┐
                    │APPROVED_FOR │
                    │   _REPAIR   │
                    └──────┬──────┘
                           │ تنفيذ
                           ▼
                    ┌─────────────┐
                    │UNDER_REPAIR │
                    └──────┬──────┘
                           │ اختبار
                           ▼
                    ┌─────────────┐
                    │ UNDER_TEST  │
                    └──────┬──────┘
                           │ إكمال
                           ▼
                    ┌─────────────────┐
                    │  COMPLETED_     │
                    │  SERVICEABLE    │
                    └─────────────────┘

    مسار الشطب (من أي حالة نشطة):
    ┌─────────────┐
    │  SCRAPPED   │  ← شطب القطعة (خروج من الرصيد فقط)
    └─────────────┘
```

### الحالات المسموح الانتقال إليها / Allowed Transitions

| من / From | إلى / To | الشرط / Condition |
|---|---|---|
| DRAFT | OPEN | اكتمال البيانات الأساسية |
| OPEN | IN_INSPECTION | تعيين الفاحص |
| IN_INSPECTION | APPROVED_FOR_REPAIR | تقرير الفحص + تقدير التكاليف |
| APPROVED_FOR_REPAIR | UNDER_REPAIR | اعتماد تقدير الإصلاح |
| UNDER_REPAIR | UNDER_TEST | تسجيل إجراءات الإصلاح |
| UNDER_TEST | COMPLETED_SERVICEABLE | نجاح الاختبار |
| أي حالة نشطة | SCRAPPED | قرار الشطب |

---

## 5. خطوات العمل / Step-by-Step Workflow

### الخطوة 1: إنشاء أمر الإصلاح (DRAFT)

**عربي:**
- ينتقل منسق الإصلاح إلى قائمة **قطع الغيار → أوامر الإصلاح**.
- يضغط على **إنشاء أمر إصلاح جديد**.
- يختار القطعة المطلوب إصلاحها من قائمة القطع المعاد إرجاعها (تظهر تلقائيًا من أوامر صرف المخزون).
- يدخل البيانات الإضافية: الجهاز، المكون، الملاحظات.
- النظام يقوم بما يلي:
  - إنشاء رقم أمر إصلاح تلقائيًا عبر **NumberingService**.
  - التحقق من عدم وجود أمر إصلاح مكرر (نفس `replacementHistoryId` أو `sourceType` + `sourceId`).
  - تسجيل `createdBy` و `createdAt`.
- يحفظ الأمر في حالة **DRAFT** (لا يؤثر على الأرصدة).

**English:**
- The Repair Coordinator navigates to **Spare Parts → Repair Orders**.
- Clicks **Create New Repair Order**.
- Selects the part to repair from the returned defective parts list (auto-populated from stock issue records).
- Enters additional data: machine, component, notes.
- The system automatically:
  - Generates a repair order number via **NumberingService**.
  - Checks for duplicates (same `replacementHistoryId` or `sourceType`+`sourceId`).
  - Records `createdBy` and `createdAt`.
- Saves the order in **DRAFT** status (no balance impact).

---

### الخطوة 2: فتح الأمر للمعالجة (OPEN)

**عربي:**
- يضغط منسق الإصلاح على **فتح أمر الإصلاح**.
- النظام يقوم بتعيين الفاحص تلقائيًا أو يدويًا.
- تنتقل الحالة إلى **OPEN**.

**English:**
- The Repair Coordinator clicks **Open Repair Order**.
- The system assigns an Inspector (auto or manual).
- Status changes to **OPEN**.

---

### الخطوة 3: فحص القطعة وتقدير الإصلاح (IN_INSPECTION)

**عربي:**
- يقوم الفاحص بمعاينة القطعة وتحديد:
  - مدى الضرر.
  - قطع الغيار المطلوبة للإصلاح.
  - تكلفة العمالة المقدرة.
  - الوقت المتوقع للإصلاح.
- يسجل تقرير الفحص.
- يضغط على **إرسال للتقدير** → تنتقل الحالة إلى **IN_INSPECTION**.
- إذا قرر الفاحص أن القطعة غير قابلة للإصلاح → **شطب (SCRAPPED)**.

**English:**
- The Inspector examines the part and determines:
  - Damage extent.
  - Required replacement spare parts.
  - Estimated labor cost.
  - Expected repair time.
- Records the inspection report.
- Clicks **Submit for Estimation** → status becomes **IN_INSPECTION**.
- If the part is deemed non-repairable → **SCRAPPED**.

---

### الخطوة 4: اعتماد نطاق الإصلاح (APPROVED_FOR_REPAIR)

**عربي:**
- يقوم منسق الإصلاح (أو المشرف) بمراجعة تقدير الإصلاح.
- يعتمد النطاق والتكلفة.
- تنتقل الحالة إلى **APPROVED_FOR_REPAIR**.
- يتم حجز قطع الغيار المطلوبة (حجز فقط، لا خصم من المخزون).

**English:**
- The Repair Coordinator (or Supervisor) reviews the repair estimate.
- Approves the scope and cost.
- Status changes to **APPROVED_FOR_REPAIR**.
- Required spare parts are reserved (reservation only, no stock deduction).

---

### الخطوة 5: تنفيذ أعمال الإصلاح (UNDER_REPAIR)

**عربي:**
- يقوم فني الإصلاح بتنفيذ الإصلاح.
- يسجل إجراءات الإصلاح عبر نموذج **إجراءات الإصلاح (Repair Actions)**:
  - وصف الإجراء (مثال: "استبدال المحمل"، "لحام الشق").
  - قطع الغيار المستخدمة فعلًا (تخصم من المخزون).
  - العمالة المستخدمة (ساعات).
  - ملاحظات.
- يمكن إضافة إجراءات متعددة لأمر الإصلاح الواحد.
- بعد الانتهاء يضغط على **إكمال التنفيذ → إرسال للاختبار**.
- تنتقل الحالة إلى **UNDER_REPAIR** ثم **جاهز للاختبار**.

**English:**
- The Repair Technician performs the repair.
- Records repair actions via the **Repair Actions** form:
  - Action description (e.g., "Bearing replacement", "Crack welding").
  - Parts actually used (deducted from inventory).
  - Labor hours used.
  - Notes.
- Multiple actions can be added to one repair order.
- Upon completion, clicks **Complete Execution → Send for Testing**.
- Status changes to **UNDER_REPAIR** then to ready for testing.

---

### الخطوة 6: اختبار القطعة المُصلحة (UNDER_TEST)

**عربي:**
- يقوم مختبر الجودة باختبار القطعة.
- يتحقق من:
  - مطابقة القطعة للمواصفات الفنية.
  - عدم وجود تسريبات أو تشققات.
  - أداء القطعة ضمن الحدود المقبولة.
- يسجل نتيجة الاختبار.
- يضغط على **موافقة** → تنتقل الحالة إلى **جاهز للإكمال**.
- إذا فشل الاختبار → يعاد إلى **UNDER_REPAIR** لإعادة الإصلاح.

**English:**
- The Quality Tester tests the repaired part.
- Verifies:
  - Part meets technical specifications.
  - No leaks or cracks.
  - Performance within acceptable limits.
- Records the test result.
- Clicks **Approve** → status moves to ready for completion.
- If test fails → returned to **UNDER_REPAIR** for rework.

---

### الخطوة 7: إكمال أمر الإصلاح (COMPLETED_SERVICEABLE)

**عربي:**
- يقوم منسق الإصلاح بتأكيد الإكمال النهائي.
- **تأثير على أرصدة الحالة الشرطية:**
  - **OUT** من رصيد **REPAIRABLE** (القطعة التالفة).
  - **IN** إلى رصيد **SERVICEABLE** (القطعة الصالحة).
- يتم تسجيل حركتين في **SparePartConditionMovement**.
- تغلق الحالة إلى **COMPLETED_SERVICEABLE**.
- القطعة متاحة الآن لإعادة الاستخدام في الصيانة.

**English:**
- The Repair Coordinator confirms final completion.
- **Condition Balance Impact:**
  - **OUT** from **REPAIRABLE** balance (defective part).
  - **IN** to **SERVICEABLE** balance (serviceable part).
- Two movements are recorded in **SparePartConditionMovement**.
- Status closes as **COMPLETED_SERVICEABLE**.
- The part is now available for reuse in maintenance.

---

### مسار بديل: شطب القطعة (SCRAPPED)

**عربي:**
- يمكن شطب أمر الإصلاح من أي حالة نشطة إذا قرر الفاحص أو المشرف أن القطعة غير قابلة للإصلاح.
- **تأثير على أرصدة الحالة الشرطية:**
  - **OUT** من رصيد **REPAIRABLE** فقط (لا يوجد IN).
- تسجل حركة خروج واحدة في **SparePartConditionMovement**.
- تغلق الحالة إلى **SCRAPPED**.
- لا يمكن إعادة فتح أمر مشطوب.

**English:**
- A repair order can be scrapped from any active status if the part is deemed non-repairable.
- **Condition Balance Impact:**
  - **OUT** from **REPAIRABLE** only (no IN movement).
- One movement is recorded in **SparePartConditionMovement**.
- Status closes as **SCRAPPED**.
- A scrapped order cannot be reopened.

---

## 6. تأثير أرصدة الحالة الشرطية / Condition Balance Impact

| الحدث / Event | حالة المصدر (OUT) / Source Condition | حالة الهدف (IN) / Target Condition | ملاحظات / Notes |
|---|---|---|---|
| **COMPLETE** | REPAIRABLE | SERVICEABLE | حركتان: خروج من التالف، دخول إلى الصالح |
| **SCRAP** | REPAIRABLE | — | حركة خروج واحدة فقط |

- لا يؤثر الإكمال على **InventoryBalance** (لم يتغير عدد القطع الإجمالي).
- يتم تسجيل كل حركة في **SparePartConditionMovement** مع **audit trail**.
- يمكن تتبع تاريخ القطعة بالكامل (خروج صيانة → إصلاح → عودة خدمة).

---

## 7. منع التكرار / Duplicate Prevention

### العربية
- يتحقق النظام من عدم وجود أمر إصلاح مكرر بناءً على:
  - **replacementHistoryId**: لا يمكن إنشاء أمر إصلاحين لنفس سجل الاستبدال.
  - **sourceType + sourceId**: لا يمكن إنشاء أمر إصلاح من نفس المصدر (مثل أمر صيانة) مرتين.
- يعرض رسالة خطأ مترجمة عند اكتشاف تكرار.

### English
- The system prevents duplicate repair orders by checking:
  - **replacementHistoryId**: No two repair orders for the same replacement record.
  - **sourceType + sourceId**: No duplicate repair orders from the same source (e.g., work order).
- A localized error message is displayed if a duplicate is detected.

---

## 8. التنقل في النظام / System Navigation

### العربية
- **القائمة الرئيسية**: قطع الغيار ← أوامر الإصلاح
- **الصفحات المتاحة**:
  - قائمة أوامر الإصلاح (مع فلترة حسب الحالة والتاريخ والقطعة).
  - عرض تفاصيل أمر الإصلاح (مع علامات تبويب: المعلومات الأساسية، إجراءات الإصلاح، سجل التدقيق).
  - نموذج إنشاء أمر إصلاح جديد.
  - نموذج تسجيل إجراءات الإصلاح.
- **التقارير**: تقرير أوامر الإصلاح (حسب الحالة، الفني، الفترة الزمنية).

### English
- **Main Menu**: Spare Parts → Repair Orders
- **Available Pages**:
  - Repair Orders list (filterable by status, date, part).
  - Repair Order detail view (tabs: basic info, repair actions, audit trail).
  - New Repair Order creation form.
  - Repair Action recording form.
- **Reports**: Repair Orders report (by status, technician, date range).

---

## 9. المراجع / References

| المرجع / Reference | الوصف / Description |
|---|---|
| SOP-MNT-001 | إجراءات صيانة الأعطال / Corrective Maintenance |
| SOP-MNT-002 | إجراءات صرف مخزون الصيانة / Maintenance Stock Issue |
| SOP-MNT-005 | إدارة هيكل المنتج والتخطيط الوقائي / BOM Versioning & Planning |
| دليل النظام / User Manual | قسم قطع الغيار وأوامر الإصلاح / Spare Parts & Repair Orders Section |

---

## 10. سجل المراجعة / Revision History

| الإصدار / Version | التاريخ / Date | التغييرات / Changes | المعدّل / Author |
|---|---|---|---|
| 1.0 | 2026-07-29 | الإصدار الأولي / Initial release | فريق الصيانة / Maintenance Team |

---

*© 2026 ATsoft ERP — جميع الحقوق محفوظة / All Rights Reserved*
