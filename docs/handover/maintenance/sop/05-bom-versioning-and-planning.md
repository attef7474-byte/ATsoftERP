# إدارة هيكل المنتج والتخطيط الوقائي / BOM Versioning & Preventive Planning

| الحقل / Field | القيمة / Value |
|---|---|
| **رقم الـ SOP / SOP ID** | SOP-MNT-005 |
| **رقم الإصدار / Version** | 1.0 |
| **تاريخ التفعيل / Effective Date** | 2026-07-29 |
| **آخر مراجعة / Last Reviewed** | 2026-07-29 |
| **النظام / System** | ATsoft ERP — Maintenance (CMMS) |

---

## 1. الغرض / Purpose

### العربية
توحيد إجراءات إدارة هيكل المنتج (Bill of Materials — BOM) مع التحكم في الإصدارات، وتخطيط قطع الغيار الوقائية استنادًا إلى هيكل المنتج وجداول الصيانة الوقائية.

### English
Standardize the management of Bills of Materials (BOM) with version control, and enable preventive spare part planning based on the BOM and preventive maintenance schedules.

---

## 2. النطاق / Scope

### العربية
- جميع الآلات والمعدات التي تحتوي على هيكل منتج محدد في النظام.
- يشمل التحكم في إصدارات BOM من المسودة إلى الأرشفة.
- يشمل تخطيط قطع الغيار الوقائية المرتبطة بـ BOM.
- لا يشمل الصيانة التصحيحية أو أوامر الإصلاح.

### English
- All machines and equipment with a defined BOM in the system.
- Includes BOM version control from draft to archive.
- Includes preventive spare part planning linked to the BOM.
- Does NOT cover corrective maintenance or repair orders.

---

## 3. الأدوار / Roles

| الدور (عربي) | Role | المسؤوليات / Responsibilities |
|---|---|---|
| **مهندس الصيانة** | Maintenance Engineer | إنشاء BOM، إضافة المكونات وقطع الغيار، تقديم الإصدارات للموافقة |
| **الموافق (مشرف/مدير)** | Approver | مراجعة واعتماد إصدارات BOM الجديدة |
| **مخطط الصيانة** | Planner | إنشاء خطط قطع الغيار الوقائية بناءً على BOM وجداول الصيانة |

---

## 4. دورة حياة BOM — تدفق الحالات / BOM Lifecycle — Status Flow

```
                    ┌─────────────┐
                    │   DRAFT     │  ← الإنشاء
                    └──────┬──────┘
                           │ تقديم للموافقة
                           ▼
                    ┌─────────────┐
                    │  PENDING_   │
                    │  APPROVAL   │  ← قيد المراجعة
                    └──────┬──────┘
                     ┌─────┴─────┐
                     ▼           ▼
              ┌──────────┐  ┌──────────┐
              │ APPROVED │  │ REJECTED │
              │          │  │          │
              └─────┬────┘  └────┬─────┘
                    │            │
                    ▼            └──→ يعود إلى DRAFT للتعديل
              ┌──────────┐
              │  ACTIVE  │  ← إصدار نشط (واحد فقط لكل آلة)
              └─────┬────┘
                    │
                    │ إنشاء إصدار جديد ← مراجعة
                    ▼
              ┌──────────┐
              │ ARCHIVED │  ← إصدار سابق (للقراءة فقط)
              └──────────┘
```

### الحالات المسموح الانتقال إليها / Allowed Transitions

| من / From | إلى / To | الشرط / Condition |
|---|---|---|
| DRAFT | PENDING_APPROVAL | اكتمال جميع البيانات الأساسية |
| PENDING_APPROVAL | APPROVED | موافقة المشرف/المدير |
| PENDING_APPROVAL | REJECTED | رفض مع إضافة ملاحظات |
| REJECTED | DRAFT | إعادة فتح للتعديل |
| APPROVED | ACTIVE | تفعيل (يتم أرشفة النشط سابقًا تلقائيًا) |
| ACTIVE | ARCHIVED | إنشاء إصدار جديد وتفعيله |

---

## 5. خطوات إدارة إصدارات BOM / BOM Versioning Steps

### الخطوة 1: إنشاء BOM (DRAFT)

**عربي:**
- ينتقل مهندس الصيانة إلى **إدارة الأصول → هيكل المنتج (BOM)**.
- يختار الآلة المستهدفة.
- يضغط على **إنشاء BOM جديد**.
- يقوم ببناء الهيكل الهرمي:
  - **التجميع (Assembly)** ← المكونات الفرعية (Sub-Assembly) ← المكونات (Component) ← قطع الغيار (Spare Part).
  - كل مستوى يمكن أن يحتوي على مدخلات متعددة.
  - لكل مدخل: الكمية، الوحدة، ملاحظات.
- يضبط رقم الإصدار تلقائيًا (v1.0 للإصدار الأول).
- يحفظ → الحالة **DRAFT**.

**English:**
- The Maintenance Engineer navigates to **Asset Management → Bill of Materials (BOM)**.
- Selects the target machine.
- Clicks **Create New BOM**.
- Builds the hierarchical structure:
  - **Assembly** → Sub-Assembly → Component → Spare Part.
  - Each level can have multiple entries.
  - Each entry: quantity, unit, notes.
- The version number is auto-set (v1.0 for the first version).
- Saves → status **DRAFT**.

---

### الخطوة 2: تقديم للموافقة (PENDING_APPROVAL)

**عربي:**
- يكمل مهندس الصيانة إدخال جميع البيانات.
- يضغط على **تقديم للموافقة**.
- تنتقل الحالة إلى **PENDING_APPROVAL**.
- يتم إرسال إشعار إلى قائمة الموافقين.
- يصبح BOM غير قابل للتعديل حتى يتم البت فيه.

**English:**
- The Maintenance Engineer completes all data entry.
- Clicks **Submit for Approval**.
- Status changes to **PENDING_APPROVAL**.
- A notification is sent to the approver list.
- The BOM becomes read-only until a decision is made.

---

### الخطوة 3: الموافقة أو الرفض (APPROVED / REJECTED)

**عربي:**
- يقوم الموافق بفتح BOM ومراجعة الهيكل والمكونات.
- **إذا كانت الموافقة**:
  - يضغط على **اعتماد**.
  - تنتقل الحالة إلى **APPROVED**.
  - يصبح BOM جاهزًا للتفعيل.
- **إذا كان الرفض**:
  - يضغط على **رفض** مع إضافة سبب الرفض والملاحظات.
  - تنتقل الحالة إلى **REJECTED**.
  - يعود BOM إلى مهندس الصيانة للتعديل (DRAFT).

**English:**
- The Approver opens the BOM and reviews the structure and components.
- **If approved**:
  - Clicks **Approve**.
  - Status changes to **APPROVED**.
  - The BOM is ready for activation.
- **If rejected**:
  - Clicks **Reject** with a reason and notes.
  - Status changes to **REJECTED**.
  - Returns to the Maintenance Engineer for revision (DRAFT).

---

### الخطوة 4: تفعيل BOM (ACTIVE)

**عربي:**
- يفتح مهندس الصيانة BOM المعتمد.
- يضغط على **تفعيل**.
- النظام يقوم بما يلي:
  - تفعيل الإصدار الحالي → **ACTIVE**.
  - إذا كان هناك إصدار نشط سابق → يتم أرشفته تلقائيًا → **ARCHIVED**.
  - يصبح الإصدار النشط هو الإصدار الرسمي المستخدم في التخطيط والتنفيذ.
- **قاعدة مهمة**: يمكن أن يكون هناك إصدار **ACTIVE واحد فقط** لكل آلة في نفس الوقت.

**English:**
- The Maintenance Engineer opens the approved BOM.
- Clicks **Activate**.
- The system:
  - Activates the current version → **ACTIVE**.
  - If a previous ACTIVE version exists → auto-archives it → **ARCHIVED**.
  - The ACTIVE version becomes the official BOM used for planning and execution.
- **Important rule**: Only one **ACTIVE** version per machine at any given time.

---

### الخطوة 5: إصدار نسخة جديدة (مراجعة)

**عربي:**
- عندما يحتاج مهندس الصيانة إلى تعديل BOM نشط:
  - يفتح الإصدار النشط.
  - يضغط على **إنشاء نسخة جديدة**.
  - يقوم النظام بإنشاء نسخة جديدة برقم إصدار متزايد (مثال: v1.0 ← v2.0).
  - تكون النسخة الجديدة في حالة **DRAFT** للتعديل.
  - تبقى النسخة النشطة سارية المفعول حتى يتم تفعيل الجديدة.
- بعد اكتمال التعديلات → يكرر خطوات الموافقة → التفعيل → الأرشفة التلقائية للنسخة القديمة.

**English:**
- When the Maintenance Engineer needs to modify an ACTIVE BOM:
  - Opens the active version.
  - Clicks **Create New Version**.
  - The system creates a new version with an incremented version number (e.g., v1.0 → v2.0).
  - The new version starts in **DRAFT** status for editing.
  - The active version remains in effect until the new one is activated.
- After modifications → repeat the approval steps → activation → auto-archive of the old version.

---

### الخطوة 6: أرشفة BOM (ARCHIVED)

**عربي:**
- يتم أرشفة الإصدارات السابقة تلقائيًا عند تفعيل إصدار جديد.
- الإصدار المؤرشف هو **للقراءة فقط** — لا يمكن تعديله أو تفعيله.
- يمكن فتح الإصدار المؤرشف لعرض البيانات التاريخية.
- تبقى الإصدارات المؤرشفة متاحة في التقارير والسجلات.

**English:**
- Previous versions are automatically archived when a new version is activated.
- An archived BOM is **read-only** — cannot be edited or activated.
- Archived versions can be opened for historical reference.
- Archived versions remain available in reports and records.

---

## 6. هيكل BOM الهرمي / BOM Hierarchical Structure

```
الآلة (Machine)
│
├── التجميع 1 (Assembly 1)
│   ├── المكون الفرعي 1.1 (Sub-Assembly 1.1)
│   │   ├── المكون 1.1.1 (Component 1.1.1)
│   │   │   ├── قطعة غيار A (Spare Part A) — الكمية: 2
│   │   │   └── قطعة غيار B (Spare Part B) — الكمية: 4
│   │   └── المكون 1.1.2 (Component 1.1.2)
│   │       └── قطعة غيار C (Spare Part C) — الكمية: 1
│   └── المكون الفرعي 1.2 (Sub-Assembly 1.2)
│       └── قطعة غيار D (Spare Part D) — الكمية: 3
│
├── التجميع 2 (Assembly 2)
│   └── المكون 2.1 (Component 2.1)
│       └── قطعة غيار E (Spare Part E) — الكمية: 1
│
└── قطع غيار مباشرة (Direct Spare Parts)
    └── قطعة غيار F (Spare Part F) — الكمية: 2
```

### حقول كل مدخل في BOM / Fields per BOM Entry

| الحقل / Field | الوصف / Description | مطلوب / Required |
|---|---|---|
| **المستوى / Level** | Assembly / Sub-Assembly / Component / Spare Part | ✅ |
| **الرقم / Code** | معرف المكون أو قطعة الغيار | ✅ |
| **الاسم / Name** | اسم المكون أو قطعة الغيار | ✅ |
| **الكمية / Quantity** | العدد المطلوب للوحدة الأم | ✅ |
| **الوحدة / Unit** | وحدة القياس (قطعة، كجم، لتر، ...) | ✅ |
| **ملاحظات / Notes** | ملاحظات إضافية | اختياري |
| **مرجع / Reference** | رقم رسم أو مستند مرجعي | اختياري |

---

## 7. تخطيط قطع الغيار الوقائية / Preventive Spare Part Planning

### الخطوة 1: ربط BOM بجدول الصيانة الوقائية

**عربي:**
- ينتقل مخطط الصيانة إلى **خطة قطع الغيار الوقائية (PreventiveSparePartPlan)**.
- يختار الآلة → يتم تحميل BOM النشط تلقائيًا.
- يختار جدول الصيانة الوقائية المرتبط.
- يعرض النظام جميع قطع الغيار في BOM النشط للآلة.
- يحدد المخطط القطع المطلوب تخطيطها للصيانة الوقائية.

**English:**
- The Planner navigates to **Preventive Spare Part Plan**.
- Selects the machine → the active BOM is loaded automatically.
- Selects the linked PM schedule.
- The system displays all spare parts from the machine's active BOM.
- The Planner selects the parts to plan for preventive maintenance.

---

### الخطوة 2: حساب الكميات المطلوبة

**عربي:**
- يقوم النظام تلقائيًا بحساب الكميات المطلوبة بناءً على:
  - **تكرار الصيانة**: عدد مرات الصيانة في السنة (مستمد من الجدول).
  - **الكمية لكل صيانة**: كمية القطعة المطلوبة لكل مهمة صيانة (مستمد من BOM).
  - **معامل الأمان**: نسبة احتياطية إضافية (قابلة للتكوين).
- **مثال**: إذا كانت قطعة الغيار مطلوبة بمقدار 4 وحدات كل صيانة شهرية:
  - الكمية السنوية = 4 × 12 = 48 وحدة + معامل أمان 10% = 52.8 ≈ 53 وحدة.

**English:**
- The system automatically calculates required quantities based on:
  - **Maintenance Frequency**: number of PMs per year (from schedule).
  - **Quantity per PM**: part quantity required per maintenance task (from BOM).
  - **Safety Factor**: additional reserve percentage (configurable).
- **Example**: If a spare part requires 4 units per monthly PM:
  - Annual quantity = 4 × 12 = 48 units + 10% safety factor = 52.8 ≈ 53 units.

---

### الخطوة 3: إنشاء الحجوزات (Reservations)

**عربي:**
- بناءً على الخطة، يقوم النظام بإنشاء **حجوزات مخزون** للقطع المطلوبة.
- **هام**: الحجز لا يخصم من المخزون الفعلي — إنه فقط يحجز الكمية للاستخدام المستقبلي.
- تظهر الحجوزات عند إنشاء أمر العمل الوقائي.
- عند تنفيذ أمر الصرف الفعلي، يتم تحرير الحجز وخصم الكمية من المخزون.
- يمكن تعديل الحجوزات إذا تغيرت الخطة.

**English:**
- Based on the plan, the system creates **inventory reservations** for the required parts.
- **Important**: A reservation does not deduct from actual inventory — it only reserves the quantity for future use.
- Reservations appear when the preventive work order is created.
- When the actual stock issue is executed, the reservation is released and the quantity is deducted.
- Reservations can be adjusted if the plan changes.

---

### الخطوة 4: مراجعة الخطة وتحديثها

**عربي:**
- يمكن لمخطط الصيانة مراجعة الخطة في أي وقت وتحديثها:
  - إضافة/إزالة قطع غيار.
  - تعديل الكميات.
  - تغيير معامل الأمان.
  - ربط/فصل جداول صيانة مختلفة.
- عند تحديث الخطة، يتم إعادة حساب الحجوزات تلقائيًا.
- تحتفظ الخطة بسجل التدقيق لجميع التغييرات.

**English:**
- The Planner can review and update the plan at any time:
  - Add/remove spare parts.
  - Adjust quantities.
  - Change the safety factor.
  - Link/unlink different PM schedules.
- When the plan is updated, reservations are recalculated automatically.
- The plan maintains an audit trail of all changes.

---

## 8. قواعد التعديل / Editing Rules

| النوع / Type | الحالة / Status | قابل للتعديل؟ / Editable? | ملاحظات / Notes |
|---|---|---|---|
| **BOM** | DRAFT | ✅ نعم | تعديل كامل للهيكل |
| **BOM** | PENDING_APPROVAL | ❌ لا | بانتظار قرار الموافقة |
| **BOM** | APPROVED | ❌ لا | جاهز للتفعيل |
| **BOM** | ACTIVE | ❌ لا | للقراءة فقط — أنشئ نسخة جديدة للتعديل |
| **BOM** | ARCHIVED | ❌ لا | للقراءة فقط — سجل تاريخي |
| **خطة القطع / Spare Part Plan** | أي حالة | ✅ نعم | يمكن تحديثها في أي وقت |

---

## 9. التنقل في النظام / System Navigation

### العربية
- **القائمة الرئيسية**: إدارة الأصول ← هيكل المنتج (BOM)
- **الصفحات المتاحة**:
  - قائمة BOM (فلترة حسب الآلة، الإصدار، الحالة).
  - عرض تفاصيل BOM (عرض هيكل شجري متدرج).
  - نموذج إنشاء BOM جديد / نسخة جديدة.
  - نموذج الموافقة على BOM.
- **قائمة التخطيط الوقائي**: الصيانة الوقائية ← خطة قطع الغيار
- **الصفحات المتاحة**:
  - قائمة خطط قطع الغيار الوقائية.
  - عرض تفاصيل الخطة مع قطع الغيار والكميات المحجوزة.
  - نموذج تعديل الخطة.

### English
- **Main Menu**: Asset Management → Bill of Materials (BOM)
- **Available Pages**:
  - BOM list (filterable by machine, version, status).
  - BOM detail view (collapsible tree structure).
  - Create New BOM / New Version form.
  - BOM Approval form.
- **Preventive Planning Menu**: Preventive Maintenance → Spare Part Plan
- **Available Pages**:
  - Preventive Spare Part Plans list.
  - Plan detail view with spare parts and reserved quantities.
  - Plan edit form.

---

## 10. نصائح تشغيلية / Operational Tips

### العربية
- **الإصدار الأول**: ابدأ بإصدار DRAFT وقم ببناء الهيكل بالكامل قبل التقديم للموافقة.
- **المراجعة الدورية**: راجع BOM النشط سنويًا للتأكد من محدثيثه مع التعديلات الفعلية على الآلة.
- **تتبع التغييرات**: استخدم سجل الإصدارات لتتبع سبب كل تغيير في الهيكل.
- **التكامل مع المشتريات**: يمكن استخدام BOM كمدخل لتخطيط احتياجات المشتريات من قطع الغيار.
- **التدريب**: يجب تدريب مهندسي الصيانة على استخدام نظام BOM وفهم دورة حياة الإصدارات.

### English
- **First Version**: Start with a DRAFT and build the complete structure before submitting for approval.
- **Periodic Review**: Review the active BOM annually to ensure it reflects actual machine modifications.
- **Change Tracking**: Use the version history to track why each structural change was made.
- **Procurement Integration**: The BOM can feed into procurement planning for spare parts.
- **Training**: Maintenance Engineers must be trained on the BOM system and version lifecycle.

---

## 11. مؤشرات الأداء الرئيسية / Key Performance Indicators

| المؤشر (عربي) | KPI | الوصف / Description |
|---|---|---|
| **عدد إصدارات BOM لكل آلة** | BOM Versions per Machine | عدد المراجعات لكل آلة (مؤشر على استقرار التصميم) |
| **نسبة BOM النشط المكتمل** | Active BOM Completion Rate | نسبة الآلات التي لديها BOM نشط |
| **مدة دورة الموافقة** | Approval Cycle Time | متوسط الوقت من PENDING_APPROVAL إلى APPROVED |
| **تغطية خطة القطع الوقائية** | Preventive Plan Coverage | نسبة قطع الغيار المخطط لها من إجمالي BOM |

---

## 12. المراجع / References

| المرجع / Reference | الوصف / Description |
|---|---|
| SOP-MNT-001 | إجراءات صيانة الأعطال / Corrective Maintenance |
| SOP-MNT-003 | سير عمل أمر الإصلاح / Repair Order Workflow |
| SOP-MNT-004 | الصيانة الوقائية المبرمجة / Preventive Maintenance |
| دليل النظام / User Manual | قسم هيكل المنتج وقطع الغيار / BOM & Spare Parts Section |

---

## 13. سجل المراجعة / Revision History

| الإصدار / Version | التاريخ / Date | التغييرات / Changes | المعدّل / Author |
|---|---|---|---|
| 1.0 | 2026-07-29 | الإصدار الأولي / Initial release | فريق الصيانة / Maintenance Team |

---

*© 2026 ATsoft ERP — جميع الحقوق محفوظة / All Rights Reserved*
