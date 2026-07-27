# Security Proof — Stock Transfers (Batch R)

## Authentication & Authorization

| Aspect | Implementation |
|--------|----------------|
| Controller guard | All endpoints use `@Permissions()` decorator |
| Permission check | Each method requires specific `inventory:stock-transfer:{action}` |
| Unauthorized access | Returns 401/403 via NestJS guards |
| Role-based access | Inherits existing role/permission system |

## Input Validation

| Validation | Implementation |
|------------|----------------|
| DTO validation | Class-validator decorators on all DTOs |
| Source ≠ destination | DTO-level validation + service-level check |
| Quantity > 0 | DTO `@Min(0.01)` |
| Required fields | DTO `@IsNotEmpty()` |
| SQL injection | Prevented by Prisma parameterized queries |
| XSS | Prevented by Next.js React rendering (no dangerouslySetInnerHTML) |

## Workflow Security

| Rule | Enforcement |
|------|-------------|
| Only DRAFT can be edited | Service-level status check |
| Only APPROVED can be posted | Service-level status check |
| Posted is immutable | Service-level status check blocks all mutations |
| Delete only works on DRAFT | Service-level deletedAt+status check |
| Cancel works only on DRAFT/SUBMITTED | Service-level status check |

## Data Integrity

| Protection | Implementation |
|------------|----------------|
| Atomic posting | Prisma transaction (all-or-nothing) |
| Stock over-deduct prevention | Pre-check balance before posting |
| Concurrent access | No locking yet (acceptable for current ERP stage) |
| Soft delete | `deletedAt` field, no data destruction |
| Audit trail | All workflow timestamps and user IDs recorded |

## Sensitive Data

- No passwords, tokens, or PII stored in stock transfer tables
- Financial fields: **none** — explicitly excluded from module design
- API keys: not used in this module

## SQL Server Security

- Application connects via dedicated `atsofterp_app` user
- Only has necessary permissions (INSERT, SELECT, UPDATE on application tables)
- No DDL permissions granted to application user

## Conclusion

All endpoints are permission-guarded. Input validation prevents malformed data. Workflow enforces state machine invariants. No sensitive data exposure. Module follows the established security pattern of the existing ERP.
