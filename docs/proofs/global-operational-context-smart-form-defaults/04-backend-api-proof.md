# 04 — Backend API Proof

## Operational Context Module

| File | Lines | Purpose |
|------|------:|---------|
| `operational-context.module.ts` | 25 | Global module, registers APP_INTERCEPTOR |
| `operational-context.types.ts` | 76 | Types: ActiveOperationalContext, OperationalAccessGrant, UserAuthorizationSnapshot |
| `active-context.service.ts` | 138 | Orchestrates validation + request matching |
| `active-context.validator.ts` | 170 | Validates context selection against DB + resolver |
| `active-context.interceptor.ts` | 83 | Extracts headers, validates, asserts request matches |
| `allowed-context.resolver.ts` | 348 | Resolves allowed contexts (SUPER_ADMIN / EXPLICIT_SCOPE / LEGACY) |
| `current-active-context.decorator.ts` | 7 | Param decorator to inject active context |
| `operational-context-optional.decorator.ts` | 5 | Per-route opt-out metadata |
| `operational-context.helpers.ts` | 28 | Helper: buildWhere, withOperationalContext |
| `express-request.d.ts` | 11 | Express Request augmentation |

## Auth API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/contexts` | GET | Returns allowed contexts for current user |
| `/auth/context/validate` | POST | Validates a context selection and returns normalized context |

## Auth Service Integration

- `AuthService.getProfile()` now returns `allowedContexts`, `defaultContext`, `currentContextStatus`
- `AuthService.getUserPermissions()` returns roles + permissions + isSuperAdmin
- `AuthService.validateOperationalContext()` validates via ActiveContextValidator
- `AuthService.getAllowedContexts()` delegates to ActiveContextService

## Global Interceptor

- Active for all HTTP routes except `@Public()` or `@OperationalContextOptional()`
- Reads `x-active-company-id`, `x-active-branch-id`, `x-active-administration-id`, `x-active-department-id` headers
- Validates context via `ActiveContextValidator`
- Asserts request body/query matches context (companyId, branchId must match; administrationId/departmentId checked when present)
- Injects `request.activeContext`

## Search Module Integration

- `SearchService.searchGlobal()` and `searchEntity()` now accept `ActiveOperationalContext` parameter
- Every entity definition applies context-aware filtering (companyId, branchId, etc.)
- `lookupEntity()` also accepts context and filters accordingly

## Build

`npm run build` in `apps/api`: **PASS** (zero errors)
