# صرف وإرجاع قطع الغيار للصيانة / Maintenance Stock Issue and Return

| Field | Value |
|-------|-------|
| **SOP ID** | SOP-MNT-002 |
| **Version** | 1.0 |
| **Effective Date** | 2026-07-29 |
| **Status** | معتمد / Approved |

---

## 1. الغرض / Purpose

**AR** — توحيد إجراءات صرف قطع الغيار الخاصة بأنشطة الصيانة وضمان تتبع دقيق للمخزون وحالة القطع.

**EN** — Standardize spare part issuance for maintenance activities and ensure accurate inventory tracking and part condition management.

---

## 2. النطاق / Scope

**AR** — يطبق على صرف قطع الغيار من مستودعات نوع SPARE_PART فقط. يُمنع الصرف من مستودعات PRODUCT أو RAW_MATERIAL.

**EN** — Applies to spare part issuance from SPARE_PART warehouse type only. PRODUCT and RAW_MATERIAL warehouse types are blocked.

---

## 3. الأدوار والمسؤوليات / Roles & Responsibilities

| AR | EN | Responsibility |
|----|----|----------------|
| طالب الصرف (فني / مهندس) | Requester (Technician/Engineer) | Initiates stock issue request linked to a maintenance request |
| المعتمد | Approver (Supervisor) | Reviews and approves the issue |
| أمين المستودع | Store Keeper | Executes the physical issue, updates system records |

---

## 4. خطوات سير العمل / Workflow Steps

| Step # | Action | Role | System Action |
|--------|--------|------|---------------|
| 1 | اختيار طلب الصيانة المرتبط / Select maintenance request | Technician | يُحمّل النظام بيانات الجهاز والسياق تلقائياً / System auto-fills machine and context |
| 2 | إضافة بنود قطع الغيار / Add spare part line items | Technician | إدخال القطعة، الكمية، الحالة / Enter part, quantity, condition |
| 3 | التحقق من توفر المخزون / Validate stock availability | System | يعرض الرصيد المتاح ويؤكد التغطية / Displays available balance, confirms coverage |
| 4 | اعتماد الصرف / Approve issue | Supervisor | يُخصم المخزون من مستودع SPARE_PART / Stock deducted from SPARE_PART warehouse |
| 5 | تركيب القطعة على الجهاز / Install part on machine | Technician | يُنشأ سجل القطعة المركبة / Installed Part record created |
| 6 | تسجيل تاريخ الاستبدال / Record replacement history | System | يُسجل في سجل استبدال قطع الغيار / Entry created in replacement history |
| 7 | إزالة القطعة التالفة / Remove defective part | Technician | تُسجل القطعة التالفة بحالة REMOVED_DEFECTIVE / Defective part recorded with condition REMOVED_DEFECTIVE |
| 8 | إرجاع القطعة القابلة للإصلاح / Return repairable part | Technician | تُضاف القطعة إلى قائمة انتظار الإصلاح / Part queued for Repair Order creation |

---

## 5. قواعد المستودع / Warehouse Rules

| AR | EN |
|----|----|
| مسموح فقط بمستودعات نوع SPARE_PART | Only SPARE_PART warehouse type is allowed |
| يمنع الصرف من مستودعات PRODUCT | PRODUCT warehouse blocked |
| يمنع الصرف من مستودعات RAW_MATERIAL | RAW_MATERIAL warehouse blocked |
| يتحقق النظام تلقائياً من نوع المستودع | System validates warehouse type automatically |

---

## 6. تتبع حالة القطع / Condition Tracking

| Condition | Description | Flow |
|-----------|-------------|------|
| NEW | قطعة جديدة من المخزون / New part from stock | Issued → Installed |
| SERVICEABLE | صالحة للاستخدام / Usable after return | Returned → Re-stocked |
| REMOVED_DEFECTIVE | تالفة بعد الإزالة / Defective after removal | Removed → Scrap or Repair |
| UNDER_REPAIR | قيد الإصلاح / Under repair | Sent to Repair Order |
| REPAIRED | تم إصلاحها / Repaired | Returned to SERVICEABLE |
| SCRAPPED | تم التخلص منها / Scrapped | Final disposition |

---

## 7. التقارير / Reports

| AR | EN | Location |
|----|----|----------|
| سجل صرف قطع الغيار | Stock Issue History | Maintenance → Reports → Stock Issue |
| سجل القطع المركبة | Installed Parts Register | Maintenance → Reports → Installed Parts |
| سجل الإرجاع والإصلاح | Return & Repair Log | Maintenance → Reports → Returns |
| حركة المخزون | Inventory Movement | Inventory → Movements |

---

## 8. معالجة الأخطاء / Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| رصيد غير كافٍ / Insufficient balance | الكمية المطلوبة أكبر من الرصيد المتاح / Requested quantity exceeds available balance | تقليل الكمية أو رفع طلب توريد / Reduce quantity or raise replenishment request |
| نوع مستودع غير صحيح / Wrong warehouse type | محاولة الصرف من PRODUCT أو RAW_MATERIAL / Attempted issue from PRODUCT or RAW_MATERIAL | تغيير المستودع إلى SPARE_PART / Change warehouse to SPARE_PART |
| طلب الصيانة غير نشط / Request not active | حالة الطلب ليست IN_PROGRESS / Request status is not IN_PROGRESS | تأكيد أن الطلب في حالة IN_PROGRESS / Ensure request is IN_PROGRESS |
| القطعة غير مسجلة / Part not registered | معرف القطعة غير موجود / Part ID not found | تسجيل القطعة في شاشة قطع الغيار / Register part in Spare Parts screen |

---

## 9. الملاحق / Appendices

| # | Appendix | Description |
|---|----------|-------------|
| A | نموذج طلب صرف قطع غيار / Stock Issue Request Form | قالب الطباعة / Print template |
| B | نموذج إرجاع قطع غيار / Stock Return Form | قالب إرجاع القطع / Return template |
| C | دليل تصنيف حالة القطع / Condition Classification Guide | تعريف حالات القطع / Condition definitions |

---

## Document Control

| Version | Date | Author | Change Description |
|---------|------|--------|-------------------|
| 1.0 | 2026-07-29 | ATsoft ERP Team | Initial release |