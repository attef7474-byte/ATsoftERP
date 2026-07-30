# Validation Report — v9 Corrective + Global Error Dialog

## Build

```
cd apps/web && npm run build
→ ✓ Compiled successfully in 15.9s
→ ✓ Type check passed
→ ✓ 166 static pages generated
→ First Load JS shared by all: 102 kB (unchanged)
```

## i18n Verification

| Check | Result |
|-------|--------|
| `errorDialog` EN keys | 12 keys defined |
| `errorDialog` AR keys | 12 keys defined (match EN) |
| `errorDialog` in types.ts | ✅ Added to `TranslationNamespace` |
| EN index.ts imports error-dialog | ✅ Spread into locale |
| AR index.ts imports error-dialog | ✅ Spread into locale |

## Infrastructure Verification

| Component | Location | Status |
|-----------|----------|--------|
| `normalizeApiError()` | `lib/error-utils.ts` | ✅ Created |
| `useApiErrorHandler()` | `components/admin/error-handler.tsx` | ✅ Created |
| `ErrorModalProvider` | Mounted in `layout.tsx` | ✅ Inside ToastProvider |
| `errorDialog` namespace | `locales/{en,ar}/error-dialog.ts` | ✅ 12 keys each |
| `sidebar-group-content` CSS | `globals.css` line 351 | ✅ transition defined |
| `sidebar-group-content.open` | `sidebar.tsx` line 169 | ✅ used in render |

## Code Integrity

| Check | Result |
|-------|--------|
| Catch blocks replaced with handleApiError | ✅ 0 remaining `catch.*showToast.*error` |
| Validation toasts preserved | ✅ All `if/guard` toasts unchanged |
| Success/info toasts preserved | ✅ All `showToast('success'/'info')` unchanged |
| Forbidden modules untouched | ✅ No activation |
| DB/schema changes | ✅ None |
| Sidebar routes unchanged | ✅ All route values preserved |
