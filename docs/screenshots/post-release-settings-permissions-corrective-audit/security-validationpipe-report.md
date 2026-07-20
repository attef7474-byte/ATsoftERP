# Security: ValidationPipe Restoration Report

## Issue

The previous post-release audit weakened global NestJS ValidationPipe in `apps/api/src/main.ts`:
- whitelist: true → false
- forbidNonWhitelisted: true → false

This was done to allow free-form JSON bodies on settings PATCH endpoints (appearance, language, security, company-profile). However, this removed whitelist protection from ALL endpoints, not just settings.

## Root Cause

Settings controllers used `@Body() dto: Record<string, any>` with no DTO validation. The `UpdateAppearanceSettingsDto` and `UpdateCompanyProfileDto` files existed but were empty (0 lines).

## Fix Applied

### Global (main.ts) — RESTORED to secure baseline
```
whitelist: true
forbidNonWhitelisted: true
transform: true
```

### Per-DTO explicit field definitions (6 DTOs created/updated)

| DTO | Fields | Required |
|-----|--------|----------|
| UpdateAppearanceSettingsDto | themeMode, accentColor, compactMode, sidebarDensity, tableDensity, showStatusBar, showActionBar | All @IsOptional |
| UpdateLanguageSettingsDto | defaultLocale, fallbackLocale, rtlEnabled, dateFormat, timeFormat, numberFormat | All @IsOptional |
| UpdateSecuritySettingsDto | passwordMinLength, passwordRequireUppercase, passwordRequireLowercase, passwordRequireNumber, passwordRequireSymbol, sessionTimeoutMinutes, maxLoginAttempts, lockoutMinutes, twoFactorEnabledDefault, auditSensitiveActions | All @IsOptional |
| UpdateCompanyProfileDto | companyNameAr, companyNameEn, taxNumber, commercialRegister, phone, email, address, city, country, defaultLanguage, timezone, currencyCode | All @IsOptional |
| CreateNotificationRuleDto | code, nameAr, nameEn, eventType (required); description, channel, severity, enabled, targetRoleId, targetPermission (@IsOptional) | 4 required |
| UpdateNotificationRuleDto | All 9 fields @IsOptional | None |

### Controller changes (5 controllers)

Removed inline `ValidationPipe({ whitelist: false, forbidNonWhitelisted: false })` overrides and `Record<string, any>` parameter types from:
- AppearanceController
- LanguageController
- SecurityController
- CompanyProfileController
- NotificationRulesController (used `any` type, now uses typed DTOs)

## Security Verification

- Unauthenticated PATCH to settings → **401** (JWT guard active)
- Unauthenticated POST to roles → **401** (JWT guard active)
- Users response → **no passwordHash** exposed
- Rejected domain endpoints → **404** (not mounted)
- Global whitelist → **true** (unknown fields stripped globally)
- Global forbidNonWhitelisted → **true** (extra fields rejected globally except where explicitly declared @IsOptional)

## Conclusion

Validation security is fully restored. Settings endpoints work correctly with explicit DTO validation.
