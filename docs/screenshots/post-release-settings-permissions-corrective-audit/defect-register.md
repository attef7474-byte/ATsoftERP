# Defect Register - Settings Validation Corrective Audit

## Defect 1: Global ValidationPipe Weakened (CRITICAL)

- **Severity:** Critical
- **Found:** Previous audit (post-release full system live audit)
- **File:** apps/api/src/main.ts
- **Description:** whitelist set to false and forbidNonWhitelisted to false globally, removing security validation for all endpoints
- **Fix Applied:** Reverted to whitelist: true, forbidNonWhitelisted: true, transform: true
- **Status:** CLOSED - FIXED

## Defect 2: Empty DTO Files (HIGH)

- **Severity:** High
- **Found:** Previous audit
- **Files:** 
  - apps/api/src/modules/settings/dto/update-appearance-settings.dto.ts (0 lines)
  - apps/api/src/modules/settings/dto/update-company-profile.dto.ts (0 lines)
- **Description:** DTO files existed but were empty, providing no validation
- **Fix Applied:** Filled with explicit field definitions and class-validator decorators
- **Status:** CLOSED - FIXED

## Defect 3: Missing DTOs for Language and Security (HIGH)

- **Severity:** High
- **Found:** Current audit
- **Files:** 
  - apps/api/src/modules/settings/dto/update-language-settings.dto.ts (did not exist)
  - apps/api/src/modules/settings/dto/update-security-settings.dto.ts (did not exist)
- **Description:** No DTOs existed for language or security settings
- **Fix Applied:** Created both DTOs with full field definitions
- **Status:** CLOSED - FIXED

## Defect 4: Missing DTOs for Notification Rules (MEDIUM)

- **Severity:** Medium
- **Found:** Current audit
- **Files:** 
  - apps/api/src/modules/settings/notification-rules/dto/ (did not exist)
- **Description:** Notification rules controller used `any` type for body parameters, which with whitelist: true would strip all fields
- **Fix Applied:** Created CreateNotificationRuleDto and UpdateNotificationRuleDto with proper validation
- **Status:** CLOSED - FIXED

## Defect 5: Per-Controller ValidationPipe Override (HIGH)

- **Severity:** High
- **Found:** Previous audit
- **Files:** 
  - 4 settings controllers had inline ValidationPipe({ whitelist: false, forbidNonWhitelisted: false })
- **Description:** Individual controllers overrode global validation to bypass whitelist
- **Fix Applied:** Removed all inline overrides; replaced with typed DTO parameters
- **Status:** CLOSED - FIXED

## Summary

- Total defects found: 5
- Critical: 1
- High: 3
- Medium: 1
- All defects: CLOSED - FIXED
