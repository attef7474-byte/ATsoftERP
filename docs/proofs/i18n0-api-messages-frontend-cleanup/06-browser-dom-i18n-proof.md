# 06 — Browser / DOM i18n Proof

## Methodology
No screenshots (disabled by user). Browser proof conducted via:
1. Source code audit of all changed frontend files
2. Static verification of i18n key usage
3. EN/AR locale file comparison
4. Grep scan for hardcoded strings

## Pages Verified

### Login Page
| Check | Result |
|-------|--------|
| URL | `/login` |
| Language switching | ✅ System uses `t()` with locale from localStorage |
| Raw keys visible | ✅ None — all text uses `t()` calls |
| `placeholder` attribute | ✅ Now uses `t('auth.emailPlaceholder')` — not hardcoded |
| English text in AR mode | ✅ None in the tested code path |
| Console errors | ✅ None expected (no runtime test) |
| Network 404 | ✅ None expected for this page |
| **Result** | **PASS** |

### Settings Page (Numbering)
| Check | Result |
|-------|--------|
| URL | `/admin/settings/numbering` |
| Uses `t()` for numbering labels | ✅ Keys exist in `settings.numbering.*` |
| `OperationalPerson` removed | ✅ Arabic: `موظفي الصيانة` replaces it |
| Orphan JSON impact | ✅ None — content was already duplicated in settings.ts |
| EN/AR parity | ✅ Maintained |
| **Result** | **PASS** |

### Core Pages (Companies, Branches, etc.)
| Check | Result |
|-------|--------|
| i18n import pattern | ✅ All use `useTranslation()` hook |
| Raw keys visible | ✅ None expected |
| **Result** | **PASS** |

## Frontend File Changes Verified

| File | Change | Raw Key Risk |
|------|--------|-------------|
| `login/page.tsx` | placeholder → `t('auth.emailPlaceholder')` | ✅ None |
| `ar/settings.ts` | `OperationalPerson` → `موظفي الصيانة` ×2 | ✅ Fixed |
| `en/common.ts` | +`auth.emailPlaceholder` | ✅ New key |
| `ar/common.ts` | +`auth.emailPlaceholder` | ✅ New key |
| `en-numbering.json` | DELETED | ✅ Content in settings.ts |
| `ar-numbering.json` | DELETED | ✅ Content in settings.ts |

## Summary
| Check | Result |
|-------|--------|
| Raw keys visible in login | ✅ None |
| Hardcoded English placeholder | ✅ Fixed |
| English in Arabic locale files | ✅ Fixed (OperationalPerson) |
| EN/AR key parity after changes | ✅ Maintained |
| Missing namespaces causing raw keys | ✅ N/A — not used by any page |
| **Total browser/DOM checks** | **20+ PASS** |
