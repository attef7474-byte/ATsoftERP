# الصيانة الوقائية المبرمجة / Preventive Maintenance

| الحقل / Field | القيمة / Value |
|---|---|
| **رقم الـ SOP / SOP ID** | SOP-MNT-004 |
| **رقم الإصدار / Version** | 1.0 |
| **تاريخ التفعيل / Effective Date** | 2026-07-29 |
| **آخر مراجعة / Last Reviewed** | 2026-07-29 |
| **النظام / System** | ATsoft ERP — Maintenance (CMMS) |

---

## 1. الغرض / Purpose

### العربية
توحيد إجراءات جدولة وتنفيذ ومتابعة أعمال الصيانة الوقائية لضمان تشغيل المعدات بكفاءة عالية، تقليل الأعطال المفاجئة، وإطالة العمر الافتراضي للأصول.

### English
Standardize the scheduling, execution, and follow-up of preventive maintenance activities to ensure efficient equipment operation, reduce unexpected breakdowns, and extend asset lifespan.

---

## 2. النطاق / Scope

### العربية
- جميع الآلات والمعدات المسجلة في النظام والتي تحتوي على جداول صيانة وقائية (PM Schedules).
- يشمل الصيانة الدورية والمقررة مسبقًا.
- لا يشمل أعمال الصيانة التصحيحية (العطل) أو أوامر الإصلاح.

### English
- All machines and equipment registered in the system with Preventive Maintenance (PM) schedules.
- Covers periodic and pre-scheduled maintenance.
- Does NOT include corrective (breakdown) maintenance or repair orders.

---

## 3. الأدوار / Roles

| الدور (عربي) | Role | المسؤوليات / Responsibilities |
|---|---|---|
| **مخطط الصيانة** | Maintenance Planner | إنشاء جداول الصيانة الوقائية، تحديد المهام والفترات الزمنية |
| **مشرف الصيانة** | Supervisor | مراجعة أوامر العمل الوقائية المستحقة، تعيين الفنيين، متابعة التنفيذ |
| **فني الصيانة** | Technician | تنفيذ أعمال الصيانة الوقائية، تسجيل نتائج قوائم الفحص، إغلاق الأمر |

---

## 4. أنواع الجداول / Schedule Types

| النوع (عربي) | Type | الوصف / Description | مثال / Example |
|---|---|---|---|
| **زمني — يومي** | Time-based — Daily | مهام يومية متكررة | فحص الزيت يوميًا |
| **زمني — أسبوعي** | Time-based — Weekly | مهام أسبوعية | تنظيف الفلاتر أسبوعيًا |
| **زمني — شهري** | Time-based — Monthly | مهام شهرية | تشحيم المحامل شهريًا |
| **زمني — سنوي** | Time-based — Yearly | مهام سنوية | الفحص الشامل السنوي |
| **حسب عداد التشغيل** | Meter-based — Hours | بناءً على ساعات التشغيل | تغيير الزيت كل 500 ساعة |
| **حسب عداد الدورات** | Meter-based — Cycles | بناءً على عدد دورات التشغيل | فحص الأحزمة كل 10,000 دورة |

### خيارات الجدولة الإضافية / Additional Scheduling Options

- **تاريخ بدء محدد**: تحديد تاريخ بدء الجدول الزمني.
- **تاريخ انتهاء**: اختياري — إذا لم يحدد يستمر الجدول بشكل غير محدد.
- **إعادة جدولة تلقائية**: بعد إتمام أمر العمل، يقوم النظام بإنشاء الأمر التالي تلقائيًا.
- **إشعارات قبل الاستحقاق**: إرسال إشعارات للمشرف قبل (X) يومًا من تاريخ الاستحقاق.

---

## 5. خطوات العمل / Workflow Steps

### الخطوة 1: إنشاء جدول الصيانة الوقائية

**عربي:**
- ينتقل مخطط الصيانة إلى **الصيانة الوقائية → جداول الصيانة**.
- يضغط على **إنشاء جدول جديد**.
- يدخل البيانات التالية:
  - **الآلة**: اختيار من قائمة الآلات المسجلة.
  - **نوع الجدول**: زمني أو حسب العداد.
  - **المدة/التكرار**: يومي، أسبوعي، شهري، سنوي، أو عدد ساعات/دورات.
  - **المهام**: قائمة مهام الصيانة المطلوبة.
  - **قائمة الفحص (Checklist)**: ربط قائمة فحص موجودة أو إنشاء جديدة.
  - **المستندات المطلوبة**: ربط أدلة التشغيل أو الصيانة إن وجدت.
  - **الأولوية**: عاجلة، عالية، متوسطة، منخفضة.
  - **جهة الاتصال**: قسم أو شخص للمتابعة.
- يحفظ الجدول → يصبح نشطًا ويبدأ النظام في احتساب مواعيد الاستحقاق.

**English:**
- The Maintenance Planner navigates to **Preventive Maintenance → Schedules**.
- Clicks **Create New Schedule**.
- Enters the following data:
  - **Machine**: Select from registered machines.
  - **Schedule Type**: Time-based or Meter-based.
  - **Duration/Frequency**: Daily, Weekly, Monthly, Yearly, or hours/cycles.
  - **Tasks**: List of required maintenance tasks.
  - **Checklist**: Link an existing checklist or create a new one.
  - **Required Documents**: Link operation or maintenance manuals if available.
  - **Priority**: Urgent, High, Medium, Low.
  - **Contact**: Department or person for follow-up.
- Saves the schedule → becomes active, and the system starts calculating due dates.

---

### الخطوة 2: إنشاء أوامر العمل الوقائية تلقائيًا

**عربي:**
- يقوم النظام تلقائيًا بإنشاء أوامر عمل وقائية (Work Orders) عند اقتراب تاريخ الاستحقاق أو الوصول إلى قراءة العداد المحددة.
- يتم إنشاء أمر العمل بالبيانات التالية:
  - نوع الأمر: **Preventive Maintenance**.
  - الآلة والمهام المستمدة من الجدول.
  - الحالة الافتراضية: **PENDING** (معلق).
  - تاريخ الاستحقاق.
- تظهر الأوامر المستحقة في لوحة تحكم المشرف.

**English:**
- The system automatically generates preventive work orders when the due date approaches or the meter reading threshold is reached.
- Each work order is created with:
  - Type: **Preventive Maintenance**.
  - Machine and tasks derived from the schedule.
  - Default status: **PENDING**.
  - Due date.
- Due orders appear on the Supervisor's dashboard.

---

### الخطوة 3: مراجعة وتعيين الفنيين

**عربي:**
- يقوم مشرف الصيانة بمراجعة أوامر العمل الوقائية المستحقة من لوحة التحكم أو قائمة أوامر العمل.
- يقوم بما يلي:
  - مراجعة نطاق العمل والمهام.
  - تعيين فني واحد أو أكثر للأمر.
  - تحديد الأولوية والتاريخ المتوقع للبدء والانتهاء.
  - إضافة ملاحظات أو تعليمات خاصة.
- يضغط على **اعتماد التعيين** → تنتقل الحالة إلى **ASSIGNED** (معين).

**English:**
- The Supervisor reviews due preventive work orders from the dashboard or work orders list.
- Performs the following:
  - Reviews scope and tasks.
  - Assigns one or more technicians.
  - Sets priority and expected start/end dates.
  - Adds notes or special instructions.
- Clicks **Confirm Assignment** → status changes to **ASSIGNED**.

---

### الخطوة 4: تنفيذ الصيانة الوقائية

**عربي:**
- يستلم فني الصيانة أمر العمل عبر التطبيق أو واجهة النظام.
- يقوم بما يلي:
  - فتح الأمر → تنتقل الحالة إلى **IN_PROGRESS** (قيد التنفيذ).
  - تنفيذ المهام حسب قائمة الفحص المرفقة.
  - تسجيل نتائج كل بند في قائمة الفحص:
    - مطابق ✅ / غير مطابق ❌ / غير قابل للتطبيق ⏭️.
    - إضافة قراءات (مثل درجة حرارة، ضغط، اهتزاز) عند الحاجة.
  - تسجيل قطع الغيار المستهلكة (إن وجدت) عبر أمر صرف مخزون الصيانة.
  - إضافة ملاحظات حول أي ملاحظات فنية.
  - رفع الصور أو المستندات الداعمة إذا لزم الأمر (اختياري).

**English:**
- The Technician receives the work order via the app or system interface.
- Performs the following:
  - Opens the order → status changes to **IN_PROGRESS**.
  - Executes tasks according to the attached checklist.
  - Records results for each checklist item:
    - Pass ✅ / Fail ❌ / N/A ⏭️.
    - Adds readings (e.g., temperature, pressure, vibration) when needed.
  - Records consumed spare parts (if any) via a maintenance stock issue.
  - Adds notes about any technical observations.
  - Uploads supporting images or documents if needed (optional).

---

### الخطوة 5: التحقق والإغلاق

**عربي:**
- بعد الانتهاء من التنفيذ، يضغط الفني على **إكمال الأمر** → تنتقل الحالة إلى **COMPLETED** (مكتمل).
- يقوم مشرف الصيانة بمراجعة نتائج التنفيذ وقائمة الفحص.
- إذا كانت النتائج مطابقة → يضغط على **إغلاق** → تنتقل الحالة إلى **CLOSED** (مغلق).
- إذا كانت النتائج غير مطابقة → يعيد الأمر إلى الفني مع ملاحظات للتصحيح.

**English:**
- After execution, the Technician clicks **Complete Order** → status changes to **COMPLETED**.
- The Supervisor reviews execution results and the checklist.
- If results are satisfactory → clicks **Close** → status changes to **CLOSED**.
- If results are unsatisfactory → returns the order to the technician with correction notes.

---

### الخطوة 6: تسجيل التوقفات أثناء الصيانة الوقائية

**عربي:**
- إذا اكتشف الفني أثناء الصيانة الوقائية عطلًا أو توقفًا غير مخطط له:
  - يسجل **توقف (Downtime)** مرتبطًا بأمر العمل الوقائي.
  - يدخل: تاريخ/وقت البداية والنهاية، سبب التوقف، التصنيف.
  - يمكن تحويل التوقف إلى أمر صيانة تصحيحية إذا لزم الأمر.
- يتم تسجيل التوقف في **Downtime Log** لأغراض تقارير الموثوقية و OEE.

**English:**
- If the technician discovers an unplanned breakdown during preventive maintenance:
  - Records a **Downtime** event linked to the preventive work order.
  - Enters: start/end date and time, reason, classification.
  - The downtime can be escalated into a corrective maintenance order if needed.
- The downtime is recorded in the **Downtime Log** for reliability and OEE reporting.

---

## 6. التكامل مع التخطيط الوقائي لقطع الغيار / Integration with Preventive Spare Part Planning

### العربية
- يمكن ربط جدول الصيانة الوقائية بـ **PreventiveSparePartPlan (خطة قطع الغيار الوقائية)**.
- يقوم مخطط الصيانة بتحديد قطع الغيار المطلوبة لكل مهمة وقائية.
- النظام يقوم بحساب الكميات المطلوبة بناءً على تكرار الجدول.
- يتم إنشاء حجز للمخزون (Reservation) — لا خصم فعلي حتى أمر الصرف.
- عند إنشاء أمر العمل الوقائي، تظهر قطع الغيار المحجوزة في الأمر لسهولة الصرف.

### English
- The PM schedule can be linked to a **PreventiveSparePartPlan**.
- The Planner defines the spare parts required for each preventive task.
- The system calculates required quantities based on schedule frequency.
- An inventory reservation is created — no actual deduction until the stock issue order.
- When the preventive work order is created, reserved parts appear on the order for easy issuance.

---

## 7. عرض التقويم / Calendar View

### العربية
- تعرض لوحة **تقويم عبء العمل (Calendar Workload)** جميع أوامر الصيانة الوقائية المجدولة على تقويم شهري/أسبوعي.
- يمكن للمشرف:
  - رؤية توزيع العمل على الفنيين والأيام.
  - إعادة جدولة الأوامر بالسحب والإفلات.
  - تحديد أيام الذروة والازدحام.
  - توزيع العمل بشكل متوازن لتجنب التحميل الزائد على الفنيين.

### English
- The **Calendar Workload** view displays all scheduled preventive work orders on a monthly/weekly calendar.
- The Supervisor can:
  - Visualize workload distribution across technicians and days.
  - Reschedule orders via drag-and-drop.
  - Identify peak days and bottlenecks.
  - Distribute work evenly to avoid overloading technicians.

---

## 8. مراقبة مستوى الخدمة / SLA Monitoring

### العربية
- يتم تتبع أوامر الصيانة الوقائية المتأخرة عبر وحدة **SLA**.
- يقوم النظام بتنبيه المشرف عند:
  - اقتراب موعد الاستحقاق (إشعار تحذيري).
  - تجاوز موعد الاستحقاق (إشعار تأخير).
- يتم حساب مؤشرات الأداء:
  - **نسبة الالتزام بالجدول**: (الأوامر المنفذة في الوقت المحدد / إجمالي الأوامر).
  - **متوسط وقت التأخير**: عدد الأيام التي تتجاوز تاريخ الاستحقاق.
- التقارير متاحة في لوحة معلومات الصيانة.

### English
- Overdue preventive work orders are tracked via the **SLA** module.
- The system alerts the Supervisor when:
  - Due date is approaching (warning notification).
  - Due date is passed (overdue notification).
- Performance indicators are calculated:
  - **Schedule Adherence**: (orders completed on time / total orders).
  - **Average Delay**: days past the due date.
- Reports are available on the maintenance dashboard.

---

## 9. التنقل في النظام / System Navigation

### العربية
- **القائمة الرئيسية**: الصيانة ← الصيانة الوقائية
- **الصفحات المتاحة**:
  - قائمة جداول الصيانة الوقائية (إنشاء/تعديل/إلغاء).
  - قائمة أوامر العمل الوقائية (فلترة حسب الحالة، التاريخ، الآلة، الفني).
  - عرض تفاصيل أمر العمل الوقائي (مع قائمة الفحص، قطع الغيار، التوقفات).
  - تقويم عبء العمل.
  - تقرير الالتزام بالصيانة الوقائية.
  - تقرير مؤشرات أداء الصيانة الوقائية.

### English
- **Main Menu**: Maintenance → Preventive Maintenance
- **Available Pages**:
  - PM Schedules list (create/edit/cancel).
  - Preventive Work Orders list (filterable by status, date, machine, technician).
  - Preventive Work Order detail view (with checklist, parts, downtime).
  - Calendar Workload view.
  - PM Schedule Adherence report.
  - PM Performance Indicators report.

---

## 10. نصائح تشغيلية / Operational Tips

### العربية
- **الجدولة الذكية**: استخدم الجداول حسب عداد التشغيل للآلات ذات ساعات التشغيل المتغيرة بدلًا من التواريخ الثابتة.
- **قوائم الفحص**: أعد قوائم فحص شاملة لكل نوع آلة لضمان تغطية جميع نقاط الفحص.
- **قطع الغيار**: اربط خطة قطع الغيار الوقائية بالجدول لتجنب نفاد المخزون في وقت الحاجة.
- **التقارير**: راجع تقارير الالتزام شهريًا لتحسين كفاءة الصيانة الوقائية.
- **التدريب**: درب الفنيين على استخدام النظام لتسجيل البيانات بدقة أثناء التنفيذ.

### English
- **Smart Scheduling**: Use meter-based scheduling for machines with variable operating hours instead of fixed dates.
- **Checklists**: Prepare comprehensive checklists for each machine type to ensure all inspection points are covered.
- **Spare Parts**: Link preventive spare part plans to schedules to avoid stock-outs when needed.
- **Reports**: Review adherence reports monthly to improve PM efficiency.
- **Training**: Train technicians on using the system to record data accurately during execution.

---

## 11. المراجع / References

| المرجع / Reference | الوصف / Description |
|---|---|
| SOP-MNT-001 | إجراءات صيانة الأعطال / Corrective Maintenance |
| SOP-MNT-003 | سير عمل أمر الإصلاح / Repair Order Workflow |
| SOP-MNT-005 | إدارة هيكل المنتج والتخطيط الوقائي / BOM Versioning & Planning |
| دليل النظام / User Manual | قسم الصيانة الوقائية / Preventive Maintenance Section |

---

## 12. سجل المراجعة / Revision History

| الإصدار / Version | التاريخ / Date | التغييرات / Changes | المعدّل / Author |
|---|---|---|---|
| 1.0 | 2026-07-29 | الإصدار الأولي / Initial release | فريق الصيانة / Maintenance Team |

---

*© 2026 ATsoft ERP — جميع الحقوق محفوظة / All Rights Reserved*
