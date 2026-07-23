# i18n Proof

## Check Script
```
npm run i18n:check
→ i18n check passed. 2170 keys in en.ts, 2170 keys in ar.ts, fully synchronized.
```

## New Keys Added

### maintenance namespace (EN)
| Key | Value |
|-----|-------|
| operationTypes | Operation Types |
| operationType | Operation Type |
| newOperationType | New Operation Type |
| editOperationType | Edit Operation Type |
| costCenters | Cost Centers |
| costCenter | Cost Center |
| newCostCenter | New Cost Center |
| editCostCenter | Edit Cost Center |
| type | Type |
| parent | Parent |

### maintenance namespace (AR)
| Key | Value |
|-----|-------|
| operationTypes | أنواع العمليات |
| operationType | نوع العملية |
| newOperationType | نوع عملية جديد |
| editOperationType | تعديل نوع العملية |
| costCenters | مراكز التكلفة |
| costCenter | مركز تكلفة |
| newCostCenter | مركز تكلفة جديد |
| editCostCenter | تعديل مركز التكلفة |
| type | النوع |
| parent | أصل |

### navigation namespace (EN)
| Key | Value |
|-----|-------|
| operationTypes | Operation Types |
| costCenters | Cost Centers |

### navigation namespace (AR)
| Key | Value |
|-----|-------|
| operationTypes | أنواع العمليات |
| costCenters | مراكز التكلفة |

## Verification
- All keys exist in both EN and AR
- No raw i18n keys exposed in UI (verified by build + runtime)
- Count: 10 maintenance keys × 2 locales + 2 navigation keys × 2 locales = 24 new keys total
