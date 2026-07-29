# 07 — i18n Proof

## API Messages (`api-messages.ts`)

10 new operational context message keys added in both EN and AR:

| Key | EN | AR |
|-----|----|----|
| `operationalContext.headersRequired` | Active company and branch context headers are required | يجب تحديد الشركة والفرع في سياق العمل النشط |
| `operationalContext.companyRequired` | Company is required for the operational context | الشركة مطلوبة لسياق العمل |
| `operationalContext.branchRequired` | Branch is required for the operational context | الفرع مطلوب لسياق العمل |
| `operationalContext.notAllowed` | The selected operational context is not allowed for this user | سياق العمل المحدد غير مسموح لهذا المستخدم |
| `operationalContext.invalidRelationship` | The company, branch, administration, or department relationship is invalid | علاقة الشركة أو الفرع أو الإدارة أو القسم غير صالحة |
| `operationalContext.companyMismatch` | The request company does not match the active operational context | الشركة في الطلب لا تطابق سياق العمل النشط |
| `operationalContext.branchMismatch` | The request branch does not match the active operational context | الفرع في الطلب لا يطابق سياق العمل النشط |
| `operationalContext.administrationMismatch` | The request administration does not match the active operational context | الإدارة في الطلب لا تطابق سياق العمل النشط |
| `operationalContext.departmentMismatch` | The request department does not match the active operational context | القسم في الطلب لا يطابق سياق العمل النشط |

## Frontend Messages (`en/common.ts`, `ar/common.ts`)

13 new keys added in both EN and AR:

| Key | EN | AR |
|-----|----|----|
| `auth.context.title` | Select Operational Context | تحديد سياق العمل |
| `auth.context.requiredHint` | Please select your operational context to continue | الرجاء تحديد سياق العمل للمتابعة |
| `auth.context.switchHint` | Switch to a different operational context | التبديل إلى سياق عمل مختلف |
| `auth.context.switch` | Switch context | تبديل السياق |
| `auth.context.current` | Current | الحالي |
| `auth.context.confirm` | Confirm | تأكيد |
| `auth.context.close` | Close | إغلاق |
| `auth.context.loading` | Loading operational contexts... | جاري تحميل سياقات العمل... |
| `auth.context.validationError` | Could not validate this context. Please try again. | تعذر التحقق من صحة هذا السياق. يرجى المحاولة مرة أخرى |
| `auth.context.unavailableTitle` | No operational contexts available | لا توجد سياقات عمل متاحة |
| `auth.context.unavailableHint` | Contact your administrator to assign you access to a company and branch. | اتصل بمسؤول النظام لتعيين صلاحية الوصول لشركة وفرع |
| `auth.logout` | Logout | تسجيل الخروج |
| `common.unavailable` | N/A | غير متاح |

## Verification

- EN/AR key parity: 13/13 frontend + 9/9 API = 22/22 keys matched
- No raw English strings in context UI components
- All user-facing API rejections use messageKey pattern
- Frontend components use `useTranslation()` hook exclusively
