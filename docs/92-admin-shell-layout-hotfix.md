# تقرير الإصلاح العاجل — تصميم الهيكل الإداري (Admin Shell Layout Hotfix)

**التاريخ:** 2026-07-15  
**الفرع:** main  
**الكوميت:** 2bffcf3  
**الوسم:** atsoft-erp-admin-shell-layout-hotfix  
**الحالة:** ✅ مكتمل  

## المشكلات التي تم إصلاحها

### 1. تخطيط الشريط الجانبي (Sidebar Layout)
- **قبل:** الشريط الجانبي كان `fixed` مع `left-0` بغض النظر عن اللغة، والمحتوى الرئيسي يستخدم `lg:pl-64`. في الوضع العربي (RTL)، يظهر الشريط على اليسار والمحتوى يندفع لليمين — مما يسبب تداخل المحتوى وظهوره أسفل الشريط.
- **بعد:** استخدام `flex` container مع `flex-1` للمحتوى الرئيسي. الشريط الجانبي يظهر دائماً على الجهة الصحيحة حسب اللغة: `left-0` للإنجليزية، `right-0` للعربية. الانتقال بين الأجهزة المحمولة وسطح المكتب يعمل عبر `lg:relative`.

### 2. مفاتيح React المكررة (Duplicate Keys)
- **قبل:** `key={child.href}` كان يسبب تحذيرات تصادم لأن 4 عناصر رئيسية تستخدم `href='#'`.
- **بعد:** تم إضافة `id` فريد لكل عنصر (`dashboard`, `core`, `core-companies`, إلخ) واستخدام `key={item.id}` و `key={child.id}`.

### 3. لوحة المستخدم في المكان الخطأ
- **قبل:** اسم المستخدم، زر تسجيل الخروج، وزر تغيير اللغة كانوا في الشريط العلوي (topbar) — مما يسبب ازدحاماً ومساحة فارغة كبيرة.
- **بعد:** تم نقل كل هذه العناصر إلى أسفل الشريط الجانبي في لوحة مدمجة: الصورة الشخصية، الاسم، البريد الإلكتروني، زر تغيير اللغة، وزر تسجيل الخروج.

### 4. مفتاح `common.logout` مفقود
- **قبل:** الزر يستخدم `t('common.logout')` ولكن الترجمة كانت موجودة فقط في `auth.logout`. هذا يؤدي إلى ظهور النص الخام `common.logout` في الواجهة.
- **بعد:** تم إضافة `logout: 'Logout'` إلى `common` في كلا الملفين `en.ts` و `ar.ts`.

### 5. التجاوز الأفقي (Horizontal Overflow)
- **قبل:** عدم وجود تحكم في التجاوز الأفقي يسبب ظهور شريط تمرير أفقي في بعض الصفحات.
- **بعد:** تم إضافة `overflow-x-hidden` على الـ body و container الرئيسي و main، مع `overflow-x-auto` للجداول فقط عبر الكلاس `table-wrapper`. استخدام `min-w-0` على العناصر المرنة لمنع التمدد.

## الملفات المعدلة

| الملف | التغيير |
|-------|---------|
| `apps/web/src/components/admin/admin-shell.tsx` | إعادة هيكلة كاملة للتخطيط، إضافة `id` للعناصر، نقل لوحة المستخدم، دعم RTL |
| `apps/web/src/app/globals.css` | إضافة `overflow-x: hidden` للـ body، إضافة كلاس `table-wrapper` |
| `apps/web/src/lib/i18n/locales/en.ts` | إضافة `logout` إلى `common` namespace |
| `apps/web/src/lib/i18n/locales/ar.ts` | إضافة `logout` إلى `common` namespace |

## التحقق

- ✅ `tsc --noEmit` — 0 أخطاء
- ✅ `next build` — 28 صفحة، 0 أخطاء
- ✅ `next dev` — الصفحات تخدم بشكل صحيح (200 OK)
- ✅ Screenshots لـ 7 صفحات ممثلة
- ✅ الكوميت والوسم والدفع إلى GitHub

## لقطات الشاشة

متوفرة في `docs/screenshots/hotfix/`:
- `dashboard.png`
- `machines.png`
- `inventory-counts.png`
- `companies.png`
- `users.png`
- `products.png`
- `maintenance-requests.png`

---

*الكلمات المفتاحية: layout, sidebar, RTL, i18n, duplicate keys, admin shell, ui hotfix*
