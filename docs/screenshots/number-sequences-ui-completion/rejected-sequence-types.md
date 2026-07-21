# Rejected Sequence Types (Not Active in Current Release)

These sequence types belong to rejected/unapproved domains. They MUST be:
1. Not shown in the active Number Sequences page (or shown as INACTIVE with clear label)
2. Marked with status = "USER_REJECTED_FOR_CURRENT_RELEASE"
3. Hidden from default view unless user explicitly enables "Show Rejected" filter

## Sales Domain (3)
| Code | Name (EN) | Name (AR) | Prefix | Domain | Status |
|------|-----------|-----------|--------|--------|--------|
| CUSTOMER | Customer | العميل | CUS- | Sales | REJECTED |
| SALES_ORDER | Sales Order | أمر البيع | SO- | Sales | REJECTED |
| INVOICE | Invoice | الفاتورة | INV- | Sales | REJECTED |

## Purchasing Domain (2)
| Code | Name (EN) | Name (AR) | Prefix | Domain | Status |
|------|-----------|-----------|--------|--------|--------|
| SUPPLIER | Supplier | المورد | SUP- | Purchasing | REJECTED |
| PURCHASE_ORDER | Purchase Order | أمر الشراء | PO- | Purchasing | REJECTED |

## Finance Domain (1)
| Code | Name (EN) | Name (AR) | Prefix | Domain | Status |
|------|-----------|-----------|--------|--------|--------|
| FINANCE_TRANSACTION | Finance Transaction | معاملة مالية | FT- | Finance | REJECTED |

## HR Domain (1)
| Code | Name (EN) | Name (AR) | Prefix | Domain | Status |
|------|-----------|-----------|--------|--------|--------|
| HR_EMPLOYEE | HR Employee | موظف الموارد البشرية | EMP- | HR | REJECTED |

## AI/ML Domain (0)
- No sequence types defined yet

## IoT Domain (0)
- No sequence types defined yet

## BI Domain (0)
- No sequence types defined yet

## Forecasting Domain (0)
- No sequence types defined yet

## Workflows Domain (0)
- No sequence types defined yet

## Import/Export Designer Domain (0)
- No sequence types defined yet

## Print Template Designer Domain (0)
- No sequence types defined yet

---

## Already in Seed (Must Mark as Rejected)
| Code | Current Status | Required Status |
|------|----------------|-----------------|
| BUSINESS_PARTNER | ACTIVE (seed-business-partner-permissions.ts) | USER_REJECTED_FOR_CURRENT_RELEASE |
| CUSTOMER | ACTIVE (seed-business-partner-permissions.ts) | USER_REJECTED_FOR_CURRENT_RELEASE |
| SUPPLIER | ACTIVE (seed-business-partner-permissions.ts) | USER_REJECTED_FOR_CURRENT_RELEASE |

---

## Implementation Notes
- Add `domain` field to NumberSequence model to track which domain each sequence belongs to
- Add `USER_REJECTED_FOR_CURRENT_RELEASE` status constant
- Default view should filter by status = 'ACTIVE' only
- Add "Show Rejected Domains" toggle in UI
- When creating new sequences for rejected domains, default status = 'USER_REJECTED_FOR_CURRENT_RELEASE'