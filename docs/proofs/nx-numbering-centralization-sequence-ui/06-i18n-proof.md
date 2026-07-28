# i18n Proof

## API Messages
No new API message keys were added. The existing `numbering.sequenceInactive` key (created in I18N-0) is now actively used by the hardened `NumberingService`.

Existing numbering keys that are now enforced:
| Key | AR | EN |
|-----|----|----|
| `numbering.sequenceNotFound` | تسلسل الأرقام غير موجود | Number sequence not found |
| `numbering.sequenceInactive` | تسلسل الأرقام غير نشط | Number sequence is inactive |
| `numbering.duplicateCode` | رمز التسلسل مكرر | Duplicate sequence code |
| `numbering.manualCodeNotAllowed` | الإدخال اليدوي للكود غير مسموح | Manual code entry is not allowed |
| `numbering.codeImmutable` | لا يمكن تعديل الكود بعد الإنشاء | Code is immutable after creation |
| `numbering.previewDoesNotConsumeNumber` | المعاينة لا تستهلك رقماً | Preview does not consume a number |

## Frontend i18n

### New Keys Added to `operationNameMap` (EN + AR)
- `ADMINISTRATION`, `OPENING_BALANCE`, `STOCK_ADJUSTMENT`, `PHYSICAL_COUNT`, `STOCK_TRANSFER`, `OPERATIONAL_RECEIPT`, `OPERATION_TYPE`, `COST_CENTER`, `PRODUCTION_LINE`, `SPARE_PART`

### New Keys Added to `modelNameMap` (EN + AR)
- Same 10 entity types with English model names and Arabic translated names

### Key Count Verification
- EN `settings.numbering.operationNameMap` now has 41 entries (was 31)
- AR `settings.numbering.operationNameMap` now has 41 entries (was 31)
- EN/AR match: 100%
- `modelNameMap` similarly expanded

### No Raw Keys in UI
All UI strings use `t()` calls — no hardcoded labels in the numbering page.
