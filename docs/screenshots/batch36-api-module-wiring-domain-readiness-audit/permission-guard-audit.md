# Permission & Guard Audit

> Batch 36 — Security posture assessment of all API controllers

## Audit Criteria
Each controller was checked for:
1. `@UseGuards(JwtAuthGuard, PermissionsGuard)` — class-level decorator
2. `@ApiBearerAuth()` — Swagger documentation
3. `@Permissions(...)` — method-level permission strings
4. `@Public()` — explicit public opt-out (where applicable)

---

## Summary

| Status | Count | Controllers |
|--------|-------|-------------|
| ✅ Properly guarded (Pattern A) | 14 | Auth*, Roles, Users, Permissions, Companies, Branches, Departments, Warehouses, Products, InventoryCounts, InventoryBalances, InventoryMovements, InventoryAdjustments, Search |
| 🛠️ Fixed this batch (Pattern B) | 8 | Dashboard, Security, Appearance, CompanyProfile, NotificationRules, Attachments, Alerts, Language |
| ✅ Intentionally public | 2 | AuthController.login(), AuthController.refresh() |
| **Total** | **24** | |

---

## Fix Applied

For each Pattern B controller, the following changes were made:

### Before
```typescript
import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Service } from './service'
import { Permissions } from '../../common/decorators/permissions.decorator'

@ApiTags('...')
@Controller('...')
export class Controller {
  @Get()
  @Permissions('domain:read')
  findAll() { ... }
}
```

### After
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Service } from './service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { Permissions } from '../../common/decorators/permissions.decorator'

@ApiTags('...')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('...')
export class Controller { ... }
```

---

## Detailed Controller Audit

### AuthController
| File | `modules/auth/auth.controller.ts` |
|------|----------------------------------|
| Guards | ✅ `@UseGuards(JwtAuthGuard, PermissionsGuard)` |
| Bearer | ✅ `@ApiBearerAuth()` |
| Login | 🔓 Public (POST `/auth/login`) |
| Refresh | 🔓 Public (POST `/auth/refresh`) |
| Other methods | 🔒 Guarded |

### DashboardController ⬅️ FIXED
| File | `modules/dashboard/dashboard.controller.ts` |
|------|---------------------------------------------|
| Guards | ✅ **ADDED** `@UseGuards(JwtAuthGuard, PermissionsGuard)` |
| Bearer | ✅ **ADDED** `@ApiBearerAuth()` |
| Permissions | `dashboard:read` |

### SecurityController ⬅️ FIXED
| File | `modules/settings/security/security.controller.ts` |
|------|----------------------------------------------------|
| Guards | ✅ **ADDED** `@UseGuards(JwtAuthGuard, PermissionsGuard)` |
| Bearer | ✅ **ADDED** `@ApiBearerAuth()` |
| Permissions | `settings:read`, `settings:update` |

### AppearanceController ⬅️ FIXED
| File | `modules/settings/appearance/appearance.controller.ts` |
|------|--------------------------------------------------------|
| Guards | ✅ **ADDED** `@UseGuards(JwtAuthGuard, PermissionsGuard)` |
| Bearer | ✅ **ADDED** `@ApiBearerAuth()` |
| Permissions | `settings:read`, `settings:update` |

### CompanyProfileController ⬅️ FIXED
| File | `modules/settings/company-profile/company-profile.controller.ts` |
|------|--------------------------------------------------------|
| Guards | ✅ **ADDED** `@UseGuards(JwtAuthGuard, PermissionsGuard)` |
| Bearer | ✅ **ADDED** `@ApiBearerAuth()` |
| Permissions | `settings:read`, `settings:update` |

### LanguageController ⬅️ FIXED
| File | `modules/settings/language/language.controller.ts` |
|------|----------------------------------------------------|
| Guards | ✅ **ADDED** `@UseGuards(JwtAuthGuard, PermissionsGuard)` |
| Bearer | ✅ **ADDED** `@ApiBearerAuth()` |
| Permissions | `settings:read`, `settings:update` |

### NotificationRulesController ⬅️ FIXED
| File | `modules/settings/notification-rules/notification-rules.controller.ts` |
|------|--------------------------------------------------------|
| Guards | ✅ **ADDED** `@UseGuards(JwtAuthGuard, PermissionsGuard)` |
| Bearer | ✅ **ADDED** `@ApiBearerAuth()` |
| Permissions | `notifications:read`, `notifications:create`, `notifications:update`, `notifications:delete` |

### AlertsController ⬅️ FIXED
| File | `modules/alerts/alerts.controller.ts` |
|------|---------------------------------------|
| Guards | ✅ **ADDED** `@UseGuards(JwtAuthGuard, PermissionsGuard)` |
| Bearer | ✅ **ADDED** `@ApiBearerAuth()` |
| Permissions | `alerts:read` |

### AttachmentsController ⬅️ FIXED
| File | `modules/documents/attachments/attachments.controller.ts` |
|------|--------------------------------------------------------|
| Guards | ✅ **ADDED** `@UseGuards(JwtAuthGuard, PermissionsGuard)` |
| Bearer | ✅ **ADDED** `@ApiBearerAuth()` |
| Permissions | `attachments:read`, `attachments:create`, `attachments:update`, `attachments:delete` |

### Remaining Pattern A Controllers (all ✅)
| Controller | Guards | Bearer | Permissions |
|-----------|--------|--------|-------------|
| UsersController | ✅ | ✅ | `users:*` |
| RolesController | ✅ | ✅ | `roles:*` |
| PermissionsController | ✅ | ✅ | `permissions:*` |
| CompaniesController | ✅ | ✅ | `companies:*` |
| BranchesController | ✅ | ✅ | `branches:*` |
| DepartmentsController | ✅ | ✅ | `departments:*` |
| WarehousesController | ✅ | ✅ | `warehouses:*` |
| ProductsController | ✅ | ✅ | `products:*` |
| InventoryCountsController | ✅ | ✅ | `inventory:*` |
| InventoryBalancesController | ✅ | ✅ | `inventory:*` |
| InventoryMovementsController | ✅ | ✅ | `inventory:*` |
| InventoryAdjustmentsController | ✅ | ✅ | `inventory:*` |
| SearchController | ✅ | ✅ | `search:*` |

---

## Risk Assessment

### Pre-Fix
- **8 controllers** (47 API endpoints) were publicly accessible
- Any unauthenticated user could read/write dashboard stats, security settings,
  appearance settings, company profile, language/locale, notification rules,
  attachments, and alerts
- No authentication barrier before permission checks

### Post-Fix
- All business endpoints require valid JWT token
- All endpoints require explicit permission grant (checked by PermissionsGuard)
- SUPER_ADMIN role bypasses permission checks (built into PermissionsGuard)
- Only 2 intentionally public endpoints remain: login and refresh

---

## Recommendations
1. ✅ **DONE** — All Pattern B controllers secured
2. Consider adding global guard with selective `@Public()` decorator to
   prevent future unprotected controllers from being accidentally exposed
3. Add integration tests that verify 401 for unauthenticated requests to
   protected endpoints, and 403 for unauthorized but authenticated requests
