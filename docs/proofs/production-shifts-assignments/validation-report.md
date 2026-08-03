# تقرير التحقق (Validation Report)

## ATsoftERP — Phase 1.2: Production Shifts & Assignments (ورديات الإنتاج والتخصيصات)

**التاريخ:** 3 أغسطس 2026
**الوضع:** مكتمل ✅

---

## 1. النطاق المنفذ

شريحة "ورديات الإنتاج والتخصيص" كاملة من قاعدة البيانات حتى الواجهة:

1. **Backend** — 6 خدمات/متحدِّمات (controllers) في `apps/api/src/modules/factory/production-shifts/`:
   - `ProductionShiftsService` / `production-shifts.controller.ts`
   - `ProductionShiftTemplatesService` / controller (مع أيام القالب)
   - `ProductionShiftCalendarsService` / controller (مع إدخالات الحلول اليومية + resolve)
   - `ProductionShiftAssignmentsService` / controller (+ endpoint `current`)
   - `ProductionOperationalAssignmentsService` / controller
   - `ProductionOperationalPeopleService` / controller (قراءة فقط للبحث F9)
2. **Database** — ترحيل `20260803130000_add_production_shift_assignments` (7 جداول):
   `production_shifts`, `production_shift_templates`, `production_shift_template_days`,
   `production_shift_calendars`, `production_shift_calendar_entries`,
   `production_shift_assignments`, `production_operational_assignments`.
3. **Numbering** — 5 تسلسلات ترقيم عالمية: `PS-`، `PST-`، `PSC-`، `PSA-`، `POA-`.
4. **Permissions** — 30 مفتاح صلاحية جديد (قراءة/إنشاء/تحديث/حذف/تفعيل/تعطيل لكل كيان).
5. **Frontend** — 5 صفحات إدارية + 6 محولات F9 + تسطيح تنقل.
6. **i18n** — نطاق `production.*` موسع بالعربية والإنجليزية.

---

## 2. نتائج الاختبار

| الاختبار | النتيجة |
|---|---|
| وحدة `production-operational-people` | 4/4 ✅ |
| مجموعة وحدات Factory (jest) | 337/337 ✅ |
| كامل API (jest) | **452/452 اختبار نجح** — 18 مجموعة فشل سابقة (ملفات spec فارغة، خارج نطاق الشريحة) ✅ |
| Runtime proof (API) `production-shifts-proof.ts` | **55/55** ✅ |
| اختبار المتصفح (Playwright) | **6/6** ✅ |
| TSC API (noEmit) | ✅ |
| TSC Web (noEmit) | ✅ |
| `next build` | ✅ |
| `i18n:check` | ✅ (3796 مفتاح، متزامن في EN/AR) |
| `raw-keys:check` | ✅ |
| `git diff --check` | ✅ |

---

## 3. Runtime proof — 55 حالة مغطاة

- إنشاء تلقائي للترقيم لخمسة كيانات (PS-/PST-/PSC-/PSA-/POA-).
- حساب مدة الوردية تلقائيًا (480 دقيقة).
- رفض صيغة وقت غير صالحة (400) ورفض استراحة ≥ المدة (400).
- تكرار يوم في القالب (400)، قالب بلا أيام (400)، مرجع وردية من شركة أخرى (400).
- تكرار إدخال تاريخ في التقويم (400).
- `resolve` يعيد `ENTRY` ثم `TEMPLATE` حسب الأفضلية، ويرفض خارج النطاق الزمني (400).
- تعارض تداخل تخصيص لنفس الشخص أو نفس الآلة (400).
- تعارض معرّفات المصادر (LINE+machine و machine+LINE) (400).
- **عزل الشركات**: قراءة/تحديث/حذف سجل من شركة أخرى → 404، وإسناد مرجع من شركة أخرى → 400.
- **صلاحيات**: مستخدم بدون صلاحية +≤ 403.
- تدوير الحالة (activate/deactivate) وحذف محمي بإرجاع 409 عند وجود مرجع حي.
- حذف ناعم بعد إزالة الالتزامات.
- **سجل التدقيق** (Audit): >0 حدث لكل كيان.

---

## 4. إثبات العزل البيني (Tenant isolation)

تحقق في runtime proof واختبارات المتصفح:

- الشركة أ تقرأ/تعدّل سجلها فقط (200).
- الشركة ب تحاول قراءة/تعديل نفس المعرف → **404**.
- الشركة ب تحاول إنشاء قالب/تخصيص بمرجع من الشركة أ → **400** (رفض مرجع عبر الشركات).
- الوصول غير المصرح به (token بدون صلاحية) → **403**.
- لا يُذكر `id` وحده لأخذ سجلات عبر الشركة — كل fetch مؤمّن ببيئة تشغيلية ومن وجود/انتماء.

---

## 4. إثبات المسار الحقيقي (Frontend → API → Permission → Service → DB → Audit)

- **Browser proof** (6/6): تحمّل كل صفحة نظيف (بدون أخطاء Console/شبكة/Chunk)، عرض `PS-`، `PST-`، `PSC-`، `PSA-`، `POA-` في الشبكات، وإنشاء وردية عبر واجهة الاستخدام (فتح النافذة → إدخال الاسم → حفظ → ظهور الكود التلقائي) ثم حذف التهيئة.
- **Runtime proof** (55/55): كل عملية عبر `Frontend→API→Permission→Service→Database→Audit` محققة مباشرة بحساب super admin وبيئة تشغيلية فعلية.

---

## 5. الحفاظ على البيانات

- لا يوجد `migrate reset`، لا حذف للمخطط، لا `db push` غير مراجع.
- ترحيل مطبّق ومقابل.
- بيانات موجودة سابقًا سليمة (لم تُمس جداول HR/Finance/Stock/غير النطاق).

---

## 6. نطاق مستقبلي غير مفعّل

- لم تُنشأ أي صفحات ضارّه، أو مكّاة، أو وحدات غير معتمدة.
- إنتاج ج × عمل (orders/runs/output) ليس جزءًا من هذه الشريحة ويُبنى لاحقًا وفق الدستور.

---

## 7. القيود المعروفة

- لا توجد قيود عملية. ملاحظة تجميلية: عنوان عمود "المورد" في صفحة التخصيص التشغيلي يستخدم مفيح `production.resourceType` (لا يوجد مفتاح `resource` مخصص بعد).

---

## 8. الالتزام بالدستور

- [x] العزلل الفنائي مفروض Backend (غير معتمد على frontend).
- [x] ترخيص نشر كل نافذة حساسة متدعم backend + audit.
- [x] DTO validation + رفض الحقول غير المعروفة.
- [x] حالات الإرسال المتكرر/مكافحة التكرار (متسلسلات فريدة في النطاق + فحوصات التعارض).
- [x] ترجمة عربية/إنجليزية بدون مفاتيح خام.
- [x] RTL/LTR.
- [x] اختبارات معنى لكل تغيير.
- [x] محافظ على الوحدات الموجودة بدون حلقات موازية.

**النتيجة النهائية: COMPLETE**