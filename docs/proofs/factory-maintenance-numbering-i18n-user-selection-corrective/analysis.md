# Analysis: Factory Maintenance — Auto-Numbering, i18n Fixes, User Selection

## Scope

This work addresses three interrelated issues in the ATsoftERP Factory Maintenance module:

1. **Auto-Numbering**: Machine Categories, Spare Parts, and Maintenance Personnel records were previously created without any system-generated unique identifier. Users had to manually enter a `code` value, leading to inconsistency, duplication risk, and poor UX.

2. **i18n Key Leakage**: Some UI pages rendered raw internationalization keys (e.g. `common.add`, `common.select`, `common.new`) instead of their resolved translated values. This occurred because the corresponding i18n namespace entries were missing from the translation files.

3. **User Account Linking**: The Maintenance Personnel page lacked a `userId` field, preventing operators from linking personnel records to ERP user accounts. This blocked workflows requiring user identity association (e.g. assigning work orders to a logged-in user).

## Root Causes

| Issue | Root Cause |
|---|---|
| No auto-numbering | Number sequences existed in the database but were not wired into the service layer DTOs or controllers |
| i18n keys leaking | `common.add`, `common.select`, `common.new` were referenced in component templates but absent from `common` namespace in both English and Arabic locale files |
| No user account field | `MaintenancePersonnel` Prisma model had `userId` column but the create/edit UI form omitted the field; the service layer had no conflict check for duplicate `userId` |

## Fix Strategy

- **Backend**: Inject `NumberingService` into the three maintenance service classes. When a create DTO arrives, ignore any user-supplied `code` and call `generateNumberAtomic(sequenceKey)` inside a Prisma transaction to guarantee a unique, incrementing code. Add `userId` uniqueness validation (reject duplicate with 409). Expose `userId` in the Personnel GET response.

- **Frontend**: Replace manual `code` text inputs with auto-generated read-only displays. Add a `userId` lookup component (F9-style) to the Personnel form. Fix i18n references by adding the missing keys to both locale files.

- **Data**: Three new number sequence seeds (`MACHINE_CATEGORY` / `MCAT-`, `SPARE_PART` / `SP-`, `MAINTENANCE_PERSONNEL` / `MP-`) added. Total sequences in system: 39.

## Outcome

All API endpoints return correct auto-generated codes. UI pages render with resolved i18n labels and the new user-account field. Duplicate `userId` assignment is rejected with a clear HTTP 409 response. No regressions in HR, Finance, Invoice, Business Partner, or Customer number sequences (these remain `USER_REJECTED_FOR_CURRENT_RELEASE`).
