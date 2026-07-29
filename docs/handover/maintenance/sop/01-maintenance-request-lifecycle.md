# دورة حياة طلب الصيانة / Maintenance Request Lifecycle

| Field | Value |
|-------|-------|
| **SOP ID** | SOP-MNT-001 |
| **Version** | 1.0 |
| **Effective Date** | 2026-07-29 |
| **Status** | معتمد / Approved |

---

## 1. الغرض / Purpose

**AR** — توحيد إجراءات إنشاء طلبات الصيانة وتعيينها وتنفيذها وإغلاقها لضمان كفاءة التشغيل وتقليل وقت التوقف.

**EN** — Standardize the process of creating, assigning, executing, and closing maintenance requests to ensure operational efficiency and minimize downtime.

---

## 2. النطاق / Scope

**AR** — جميع طلبات الصيانة التصحيحية والوقائية عبر جميع الأقسام والمواقع.

**EN** — All corrective and preventive maintenance requests across all departments and locations.

---

## 3. الأدوار والمسؤوليات / Roles & Responsibilities

| AR | EN | Responsibility |
|----|----|----------------|
| مقدم الطلب (المشغل) | Requester (Operator) | Initiates request with machine, problem description, priority |
| المشرف | Supervisor | Reviews, approves, assigns work |
| مهندس الصيانة | Maintenance Engineer | Diagnoses fault, plans work, specifies spare parts |
| الفني | Technician | Executes work, records actions, fills checklists |
| أمين المستودع | Store Keeper | Issues spare parts when required |
| المعتمد | Approver | Verifies completion, closes request |

---

## 4. خطوات سير العمل / Workflow Steps

| Step # | Action | Role | System Action |
|--------|--------|------|---------------|
| 1 | إنشاء طلب الصيانة / Create request | Requester | يُنشئ النظام رقم طلب تلقائياً / System generates request number |
| 2 | مراجعة الطلب واعتماده / Review & approve | Supervisor | تنتقل الحالة إلى APPROVED / Status → APPROVED |
| 3 | تعيين فني الصيانة / Assign technician | Supervisor | يُسجل التعيين في النظام / Assignment recorded |
| 4 | تشخيص العطل ووضع خطة العمل / Diagnose & plan | Engineer | تُنشأ مهام الصيانة / Tasks created |
| 5 | صرف قطع الغيار / Issue spare parts | Store Keeper | يُخصم المخزون، يُسجل الجزء المركب / Stock deducted, installed part recorded |
| 6 | تنفيذ أعمال الصيانة / Execute work | Technician | إكمال المهام، تعبئة قائمة الفحص / Task completion, checklist filled |
| 7 | فحص الجودة / Quality check | Supervisor/Engineer | التحقق من جودة العمل / Verification |
| 8 | إغلاق طلب الصيانة / Close request | Approver | تُحتسب التكاليف النهائية، الحالة CLOSED / Costs finalized, status CLOSED |

---

## 5. تدفق الحالات / Status Flow

```
                │
                ▼
            PENDING ◄────────┐
                │             │
         ┌──────┴──────┐      │
         ▼              ▼     │
     APPROVED       REJECTED  │
         │                    │
         ▼                    │
    IN_PROGRESS               │
         │                    │
         ▼                    │
    COMPLETED                 │
         │                    │
         ▼                    │
     CLOSED ──────────────────┘
```

**Rejection path (مسار الرفض):** PENDING → REJECTED → (may be re-submitted as PENDING)

---

## 6. المتطلبات الأساسية / Prerequisites

| AR | EN |
|----|----|
| الجهاز مسجل في النظام | Machine registered in system |
| قطع الغيار متوفرة في المستودع | Spare parts available in stock |
| الموظفون مسجلون ولديهم الصلاحيات | Personnel assigned with appropriate permissions |
| صلاحية الوصول إلى وحدة الصيانة | Access to Maintenance module |

---

## 7. التنقل في النظام / System Navigation

**AR:**
```
الصيانة ← طلبات الصيانة ← إنشاء طلب جديد
```

**EN:**
```
Maintenance ← Maintenance Requests ← Create New Request
```

---

## 8. الأخطاء الشائعة / Common Errors

| AR | EN | Solution |
|----|----|----------|
| الجهاز غير مسجل | Machine not registered | تسجيل الجهاز أولاً في شاشة الأجهزة / Register machine in Machines screen |
| رصيد غير كافٍ في المخزون | Insufficient stock balance | التحقق من رصيد قطع الغيار أو رفع طلب توريد / Check stock or raise a replenishment request |
| عدم تعيين فني | No technician assigned | يجب على المشرف تعيين فني قبل المتابعة / Supervisor must assign a technician before proceeding |
| قائمة الفحص غير مكتملة | Checklist incomplete | إكمال جميع بنود قائمة الفحص / Complete all checklist items |

---

## 9. الملاحق / Appendices

| # | Appendix | Description |
|---|----------|-------------|
| A | نموذج طلب الصيانة / Maintenance Request Form | قالب طباعة الطلب / Print template |
| B | قائمة الفحص العامة / General Checklist Template | نقاط التفتيش الأساسية / Standard inspection points |
| C | نموذج تسليم الجهاز / Machine Handover Form | عند نقل الجهاز بين المواقع / Machine transfer between locations |

---

## Document Control

| Version | Date | Author | Change Description |
|---------|------|--------|-------------------|
| 1.0 | 2026-07-29 | ATsoft ERP Team | Initial release |