# RTL/LTR Behavior

## Mechanism
The AdminDataGrid component accepts a `dir` prop ("ltr" | "rtl") which is passed from the i18n provider's `useTranslation()` hook.

```tsx
const { t, dir } = useTranslation();
// dir = "rtl" when locale is 'ar', "ltr" when locale is 'en'
```

This dir value is:
1. Applied to the outer container div: `<div dir={dir}>`
2. Used to control text-align in header and cells: `textAlign: col.align || (isRtl ? 'right' : 'left')`
3. Used for actions dropdown positioning: `isRtl ? 'left-0' : 'right-0'`
4. Used for column ordering in Number Sequences (sortedColumns useMemo)

## Arabic (RTL)
- Header text aligns right
- Cell text aligns right
- Actions dropdown appears to the left of the three-dot button
- Column order: actions first (rightmost), then technical fields, names at far left

## English (LTR)
- Header text aligns left
- Cell text aligns left
- Actions dropdown appears to the right of the three-dot button
- Column order: code first (leftmost), technical fields, actions at far right

## CSS Support
- Uses Tailwind utility classes
- No hardcoded left/right — uses inline styles controlled by dir prop
- Additional CSS in globals.css for sticky header behavior

## Number Sequences Specific RTL Column Order (Arabic)
الإجراءات, آخر كود, معاينة التالي, الحالة, النطاق, سياسة إعادة التعيين, المحاذاة, الزيادة, الرقم التالي, الرقم الحالي, اللاحقة, البادئة, اسم النموذج, اسم العملية, الكود

## Number Sequences Specific LTR Column Order (English)
Code, Operation Name, Model Name, Prefix, Suffix, Current Number, Next Number, Increment, Padding, Reset Policy, Scope, Status, Next Preview, Last Code, Actions
